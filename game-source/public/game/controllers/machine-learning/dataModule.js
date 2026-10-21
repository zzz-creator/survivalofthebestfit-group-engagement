import {buildUserModel, buildFakeDataModel, buildDebiasedModel, getFeaturePreference, predictPreprocResume, preprocResumes} from '~/public/game/controllers/machine-learning/modelTraining.js';
import {testClf, testInputData, reportMetrics} from '~/public/game/controllers/machine-learning/modelTesting';
import {DEBUG_MODE} from '~/public/game/controllers/constants/mlConstants.js';
import {cvCollection} from '~/public/game/assets/text/cvCollection.js';

const testAccepted = [4, 3, 7, 12, 10, 15, 18, 19, 26, 25, 29, 30, 32, 36, 37, 46, 47, 38];
const testLastIndex = 50;

class DataModule {
    constructor() {
        this.accepted = [];
        this.rejected = [];
        this.mlRejected = [];
        this.lastIndex = 0;
        this.groundTruth = [];
        this.acceptanceArrayByAlgo = [];
        this.colorArr = [];
        this.averageScore = [0, 0, 0, 0];
        this.skillFeatureSize = cvCollection.cvFeatures.length;
        this.toInspectIndex;
        this.dropCity = false;
        this.debiasStartIndex = 0;
        this.beforeAcceptance = null;
        this.afterAcceptance = null;
    }

    recordAccept(personIndex) {
        this.accepted.push(personIndex);
    }

    recordMLReject(personIndex) {
        this.mlRejected.push(personIndex);
    }

    recordLastIndex(personIndex) {
        this.lastIndex = personIndex;
    }

    getLastIndex() {
        return this.lastIndex;
    }

    getAverageScore(options) {
        let _index = 0;
        let averageScore = [0,0,0,0]
        let selectedIndexArray = [];

        // this is for an array of all selected indices
        if (options.selectedIndexArray && options.selectedIndexArray.length > 0) {
            selectedIndexArray = options.selectedIndexArray;
        } 
        // this is for an array of start and end range index
        else if (options.indexRange && options.indexRange.length == 2) {
            for (let i = options.indexRange[0]; i <= options.indexRange[1]; i++) {
                selectedIndexArray.push(i);
            }
        }

        else throw new Error('Incorrect index array passed to calculate average people scores');

        selectedIndexArray.forEach((personId) => {
            let qual = cvCollection.cvData[personId].qualifications;
            for (_index=0; _index<this.skillFeatureSize; _index++) {
                averageScore[_index] += qual[_index];
            }
        });

        for (_index=0; _index<this.skillFeatureSize; _index++) {
            averageScore[_index] = (averageScore[_index] / selectedIndexArray.length).toFixed(2);
        }

        return averageScore;
    }

    _calculateScore() {
        let hiredAverage = this.getAverageScore({selectedIndexArray: this.accepted});
        let candidateAverage = this.getAverageScore({indexRange: [0, this.lastIndex]});

        const formatScoreText = (maxDiff, maxDiffFeature) => {
            return `You hired people with ${maxDiff >= 0 ? `<u>${maxDiff}%</u> more` : `<u>${maxDiff}%</u> less`} ${maxDiffFeature.toLowerCase()} than the average applicant.`
        }

        let diff = [];
        hiredAverage.forEach((score, idx) => {
            diff.push(parseFloat(((score - candidateAverage[idx]) * 10).toFixed(1)));
        });

        let maxDiff = Math.round(Math.max(...diff));
        let maxDiffFeature = cvCollection.cvFeatures[diff.indexOf(Math.max(...diff))].name;

        return formatScoreText(maxDiff, maxDiffFeature);
    }

    train() {
        this.dropCity = false;
        // if we start from the ml lab stage, we still get real decisions
        if (!this.accepted.length) {
            this.accepted = testAccepted;
            this.lastIndex = testLastIndex;
        }

        this.rejected = this._getRejectedPeople();

        if (DEBUG_MODE) {
            console.log('\n%c SEND SCREENSHOT OF BELOW OUTPUT IF MACHINE DECISIONS ARE WRONG \n IF YOU DON\'T WANT LOGS, SEARCH FOR VARIABLE "DEBUG_MODE" => SET TO 0', 'background: #222; color: #bada55'); 
            testInputData();
        }

        // build fake data model with extracted user feature preferences
        if (DEBUG_MODE) console.log('\nTraining model - full dataset - user feature preference applied');
        this.featurePref = getFeaturePreference(this.accepted);
        this.clf = buildFakeDataModel(this.featurePref);
        
        if (testClf(this.clf, this.featurePref)) {
            gtag('event', 'userfeature-model-successful', {'event_category': 'ml', 'event_label': 'model-training'});
            return;
        }

        // if all of those failed to meet criteria, we'll just train a full fake data model
        if (DEBUG_MODE) console.log('\nTraining model - full dataset - all features');
        this.clf = buildFakeDataModel();
        
        if (testClf(this.clf, this.featurePref)) {
            gtag('event', 'fullfake-model-successful', {'event_category': 'ml', 'event_label': 'model-training'});
            return;
        }
    }

    // Retrains the model without the neighbourhood column the bias was riding on.
    // Returns the same sanity check the first model was put through, for
    // diagnostics only: the shipped model fails it too (goodMetric 0.68 < 0.85),
    // so the fairness numbers in the ending come from measureAcceptance(), not
    // from this check.
    retrainDebiased() {
        if (!this.accepted.length) {
            this.accepted = testAccepted;
            this.lastIndex = testLastIndex;
        }
        if (!this.featurePref) this.featurePref = getFeaturePreference(this.accepted);

        // what the model the class has been watching does with the whole pool,
        // measured before it is replaced
        this.beforeAcceptance = this.measureAcceptance(cvCollection.cvDataEqual);

        this.debiasStartIndex = this.acceptanceArrayByAlgo.length;
        this.dropCity = true;

        // the classifier columns and the prediction columns have to agree; if the
        // preferred-features model fails the checks, fall back to every feature
        let featurePref = this.featurePref;
        let clf = buildDebiasedModel(featurePref);
        let passes = testClf(clf, featurePref, true);

        if (!passes) {
            featurePref = null;
            clf = buildDebiasedModel();
            passes = testClf(clf, featurePref, true);
        }

        this.featurePref = featurePref;
        this.clf = clf;
        this.afterAcceptance = this.measureAcceptance(cvCollection.cvDataEqual);
        return passes;
    }

    predict(inputResume) {
        // if starting in MLlab stage, we need to quickly train to not break anything
        if (!this.clf) this.train();
        
        const result = this.clf.predict(predictPreprocResume([inputResume], this.featurePref, this.dropCity));

        // measure ongoing performance and bias
        this.groundTruth.push(inputResume.empl);
        this.acceptanceArrayByAlgo.push(result);
        this.colorArr.push(inputResume.color);
        if (this.acceptanceArrayByAlgo.length % 10 == 0) {
            reportMetrics(this.acceptanceArrayByAlgo, this.groundTruth, false, this.colorArr);
        }
        
        return result;
    }

    // everyone among the showed people who isn't accepted, is assumed to be rejected
    _getRejectedPeople() {
        let rejected = [];
        for (let i = 0; i <= this.lastIndex; i++) {
            rejected.push(i);
        }
        rejected = rejected.filter((i) => {
            return this.accepted.indexOf(i) < 0;
        });
        return rejected;
    }

    getAcceptedPeople() {
        return this.accepted;
    }

    getAcceptanceByTheAlgo() {
        return this.acceptanceArrayByAlgo;
    }

    // decisions made after the model was retrained without the neighbourhood column
    getAcceptanceSinceDebias() {
        return this.acceptanceArrayByAlgo.slice(this.debiasStartIndex);
    }

    // The whole applicant pool, as scored by the model before and by the
    // retrained model after. Both numbers are measured, never written in the
    // copy, so the ending cannot claim a fairness the model does not deliver.
    getPoolComparison() {
        if (!this.beforeAcceptance || !this.afterAcceptance) return null;
        return {
            before: this.beforeAcceptance,
            after: this.afterAcceptance,
        };
    }

    // Acceptance by colour for any pool, using the model as it stands right now.
    // The belt only shows a handful of candidates, far too few to read a rate
    // off; this is what the whole applicant pool looks like under that model.
    measureAcceptance(pool) {
        if (!this.clf) return null;
        const [features] = preprocResumes(pool, this.featurePref, this.dropCity);
        const predictions = this.clf.predict(features);
        const tally = {
            orange: {accepted: 0, total: 0},
            blue: {accepted: 0, total: 0},
        };
        predictions.forEach((prediction, index) => {
            const color = pool[index].color;
            if (!tally[color]) return;
            tally[color].total += 1;
            if (prediction == 1) tally[color].accepted += 1;
        });
        return tally;
    }

    uploadUserDecisions() {
        // this.accepted has the indices of accepted candidates
        // _getRejectedPeople() returns indices of rejected people
        // BE CAREFUL! IF DATASET IS REGENERATED ON THE PYTHON SIDE, THE INDICES STILL REFER TO THE OLD DB
        // function best called in the beginning of training
        return;
    }
}

export const dataModule = new DataModule();
