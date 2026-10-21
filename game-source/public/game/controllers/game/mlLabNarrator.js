
import {EVENTS, CLASSES, SOUNDS} from '~/public/game/controllers/constants';
import TextboxUI from '~/public/game/components/interface/ui-textbox/ui-textbox';
import InfoTooltip from '~/public/game/components/interface/ml/info-tooltip/info-tooltip';
import {gameFSM} from '~/public/game/controllers/game/stateManager.js';
import NewsFeedUI from '~/public/game/components/interface/ml/news-feed/news-feed.js';
import MlLabAnimator from '~/public/game/controllers/game/mlLabAnimator.js';
import {eventEmitter} from '~/public/game/controllers/game/gameSetup.js';
import StatsConversation from '~/public/game/components/interface/stats-conversation/transition-overlay/transition-overlay';
import * as sound from '~/public/game/controllers/game/sound.js';
import * as state from '~/public/game/controllers/common/state.js';
import TaskUI from '~/public/game/components/interface/ui-task/ui-task';
import DebiasReadout from '~/public/game/components/interface/ml/debias-readout/debias-readout';
import {dataModule} from '~/public/game/controllers/machine-learning/dataModule.js';

export default class MlLabNarrator {
    constructor() {
        this.animator = new MlLabAnimator();
        this.newsFeed = new NewsFeedUI({show: true});
        this.debiasReadout = new DebiasReadout();

        this.ML_TIMELINE = txt.mlLabStage.narration;
        this.newsTimeOffset = 6;
        this.isActive = false;
        this.scheduleTimelineUpdate = this.scheduleTimelineUpdate.bind(this);
        this._onAccepted = this._onAccepted.bind(this);
        this._onRejected = this._onRejected.bind(this);
        this._onEmailReply = this._handleEmailReply.bind(this);
        this._onExitStatsConversation = this._onExitStatsConversation.bind(this);
        // a visible message pauses the belt, but an evaluation already in flight
        // can still fire: don't let it skip to the next message
        this._messageOpen = false;
        this.hiresSinceMessage = 0;
        this.evalsSinceMessage = 0;
        this.stageGoal = 3;
        this.populateHiringGoals();

        this.task = new TaskUI({
            showTimer: false, 
            placeLeft: true,
            hires: this.ML_TIMELINE[this.ML_TIMELINE.length-1].delay,
        });

        this._addEventListeners();
        this.start();
    }

    populateHiringGoals() {
        // You can use this to debug so that ML lab stage progresses faster
        this.debugMode = false;
        
        let hiringCount = 0;

        if (this.debugMode) {
            for (let i = 0; i < this.ML_TIMELINE.length; i++) {
                this.ML_TIMELINE[i].delay = i + 1;
            }
        } else {
            for (let i = 0; i < this.ML_TIMELINE.length; i++) {
                hiringCount += this.ML_TIMELINE[i].hiresGap || this.stageGoal;
                this.ML_TIMELINE[i].delay = hiringCount;
            }
        }
    }

    start() {
        this.isActive = true;
        // DISPLAY THE FIRST NEWSFEED that happens before the first investor message
        this.newsFeed.updateNewsFeed({news: this.ML_TIMELINE[0].news});
        state.set('ml-sound', SOUNDS.ML_LAB_AMBIENT);
        sound.schedule(state.get('ml-sound'), 1);
        if (!Array.isArray(this.ML_TIMELINE)) throw new Error('The timeline needs to be an array!');
    }

    stop() {
        this.isActive = false;
    }

    scheduleTimelineUpdate() {
        if (this.ML_TIMELINE.length === 0 || !this.isActive) return;
        this._messageOpen = true;
        this.hiresSinceMessage = 0;
        this.evalsSinceMessage = 0;
        this.updateTimeline();
        if (this.ML_TIMELINE.length === 0 || !this.isActive) return;
        if (!this.ML_TIMELINE[0].hasOwnProperty('delay')) throw new Error('The ML message object needs to have a delay!');
        if ( this.ML_TIMELINE.length === 1) this.ML_TIMELINE[0].isLastMessage = true;

        this._showNewMessage(this.ML_TIMELINE[0]);

        // NEWS UPDATE
        if (!this.ML_TIMELINE[0].hasOwnProperty('news')) return;
        if (this.ML_TIMELINE[0].breaking) {
            console.log('we have breaking news!');
        }
        this.newsFeed.updateNewsFeed({news: this.ML_TIMELINE[0].news});
    };
    
    _showNewMessage(msg) {
        if (!msg.hasOwnProperty('messageFromVc') || !msg.hasOwnProperty('responses')) throw new Error('message object does not have valid properties!');
        let callback = this.textAckCallback.bind(this, msg, this.animator, this.newsFeed);
        if (msg.tooltip) callback = this.showTooltipCallback.bind({}, msg, this.newsFeed, callback);

        // the closing claim is generated from the retrained model, so the number
        // on screen can't drift away from the model the class just watched
        const content = this._fillTokens(msg.messageFromVc);
        
        this.animator.pauseAnimation();
        this.newsFeed.stop();
        this.newsFeed.hide();
        sound.fadeOut(state.get('ml-sound'), false);
        sound.play(SOUNDS.NEW_MESSAGE);

        new TextboxUI({
            show: true,
            type: CLASSES.ML,
            content: content,
            responses: msg.responses,
            callback: callback,
        });
    }

    // {poolSummary} and {retrainOutcome} are filled from measurements so the
    // closing message can never claim a fairness the model does not deliver
    _fillTokens(content) {
        if (!content) return content;
        return content
            .replace('{poolSummary}', this._poolSummaryText())
            .replace('{retrainOutcome}', this._retrainOutcomeText());
    }

    _poolSummaryText() {
        const comparison = dataModule.getPoolComparison();
        if (!comparison) return '';
        const rate = (counts) => counts.total ? Math.round(100 * counts.accepted / counts.total) : 0;
        return `Across the whole applicant pool the algorithm now accepts <u>${rate(comparison.after.orange)}% of Orange</u> and <u>${rate(comparison.after.blue)}% of Blue</u> candidates.`;
    }

    _retrainOutcomeText() {
        const decisions = dataModule.getAcceptanceSinceDebias();
        if (!decisions.length) return '';
        const accepted = decisions.filter((prediction) => prediction[0] == 1).length;
        const offers = accepted === 1 ? 'One more offer went out' : `${accepted} more offers went out`;
        return `${offers} after the retrain, and not one of them was decided by neighbourhood.`;
    }

    showTooltipCallback(msg, newsFeed, textAckCallback) {
        new InfoTooltip(msg.tooltip, textAckCallback);
        newsFeed.hide();
    }

    textAckCallback(msg, animator, newsFeed) {
        // not starting animation when we need to launch inspector
        // make sure we restart it elsewhere
        if (msg.launchCVInspector) {
            animator.datasetView.show();
            return;
        }

        if (msg.breaking) {
            newsFeed.breaking();
            sound.play(SOUNDS.BREAKING_NEWS);
        }

        if (msg.launchMachineInspector) {
            this.statsConversation = new StatsConversation({show: true, endCallback: this.textAckCallback});
            return;
        }

        // retrain in front of the class: from here on the belt is scored by the
        // model built without the city column
        if (msg.retrain) {
            dataModule.retrainDebiased();
            this.debiasReadout.show();
            sound.play(SOUNDS.TRAIN_ALGORITHM);
        }

        // if we are not inspecting anything, continue playing the background sound
        sound.play(state.get('ml-sound'));

        if (msg.isLastMessage) {
            gameFSM.nextStage();
            return;
        }

        this._messageOpen = false;
        animator.datasetView.hide();
        animator.startAnimation();
        newsFeed.start();
        newsFeed.show();
    }

    // update schedule: pop the first timer value from the array
    updateTimeline() {
        this.ML_TIMELINE = this.ML_TIMELINE.slice(1);
        console.log(this.ML_TIMELINE[0]);
    }

    _handleEmailReply() {
        this.ML_TIMELINE[0].launchCVInspector = false;
        this.ML_TIMELINE[0].launchMachineInspector = false;
        const callback = this.textAckCallback.bind(this, this.ML_TIMELINE[0], this.animator, this.newsFeed);

        new TextboxUI({
            show: true,
            type: CLASSES.ML,
            content: this.ML_TIMELINE[0].inspectQuestion,
            responses: this.ML_TIMELINE[0].inspectResponses,
            callback: callback,
            // TODO - can we do overlay??
            overlay: true,
        });        
    }

    _onAccepted() {
        this.hiresSinceMessage++;
        this.evalsSinceMessage++;
        this.debiasReadout.update();
        this._triggerTimelineUpdate();
    }

    _onRejected() {
        this.evalsSinceMessage++;
        this.debiasReadout.update();
        this._triggerTimelineUpdate();
    }

    _onExitStatsConversation() {
        this.textAckCallback({launchCVInspector: false, breaking: false, launchMachineInspector: false, isLastMessage: false}, this.animator, this.newsFeed);
    }

    _triggerTimelineUpdate() {
        if (this._messageOpen || !this.isActive) return;
        // the entry that will come up when this one is popped off the timeline
        const upNext = this.ML_TIMELINE[1];
        if (!upNext) return;
        const gap = this.debugMode ? 1 : (upNext.hiresGap || this.stageGoal);
        // a stricter model accepts fewer people, so a hire milestone on its own
        // could stall the story; fall back to the number of candidates reviewed
        if (this.hiresSinceMessage >= gap || this.evalsSinceMessage >= gap * 2) {
            this.scheduleTimelineUpdate();
        }
    }

    _addEventListeners() {
        eventEmitter.on(EVENTS.EMAIL_REPLY, this._onEmailReply);
        eventEmitter.on(EVENTS.RESUME_TIMELINE, this.scheduleTimelineUpdate);
        eventEmitter.on(EVENTS.ACCEPTED, this._onAccepted);
        eventEmitter.on(EVENTS.REJECTED, this._onRejected);
        eventEmitter.on(EVENTS.EXIT_STATS_CONVERSATION, this._onExitStatsConversation);
    }

    _removeEventListeners() {
        eventEmitter.off(EVENTS.EMAIL_REPLY, this._onEmailReply);
        eventEmitter.off(EVENTS.RESUME_TIMELINE, this.scheduleTimelineUpdate);
        eventEmitter.off(EVENTS.ACCEPTED, this._onAccepted);
        eventEmitter.off(EVENTS.REJECTED, this._onRejected);
        eventEmitter.off(EVENTS.EXIT_STATS_CONVERSATION, this._onExitStatsConversation);
    }

    destroy() {
        sound.fadeOut(state.get('ml-sound'));
        this.stop();
        // the animator teardown throws on this codebase (Floor has no destroy()),
        // so release our own listeners and DOM first
        this._removeEventListeners();
        this.debiasReadout.destroy();
        this.animator.destroy();
        this.newsFeed.destroy();
    }
}
