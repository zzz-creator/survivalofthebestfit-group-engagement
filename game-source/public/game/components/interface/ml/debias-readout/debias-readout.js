import $ from 'jquery';
import {TweenLite} from 'gsap/TweenMax';
import CLASSES from '~/public/game/controllers/constants/classes';
import {dataModule} from '~/public/game/controllers/machine-learning/dataModule.js';

// The regular statistics card is a one-off snapshot of the biased run, and the
// handful of candidates who pass the belt after the retrain is far too small a
// sample to read a rate off. So this panel scores the whole applicant pool with
// the model from before the retrain and with the retrained model, and keeps a
// live count of what the belt is actually doing since the fix.
export default class {
    constructor() {
        this.$el = $('#js-debias-readout');
        this.$title = this.$el.find('.js-debias-title');
        this.$note = this.$el.find('.js-debias-note');
        this.$cells = {
            'before-orange': this.$el.find('.js-debias-before-orange'),
            'after-orange': this.$el.find('.js-debias-after-orange'),
            'before-blue': this.$el.find('.js-debias-before-blue'),
            'after-blue': this.$el.find('.js-debias-after-blue'),
        };
        this.$values = {
            'before-orange': this.$el.find('.js-debias-before-orange-value'),
            'after-orange': this.$el.find('.js-debias-after-orange-value'),
            'before-blue': this.$el.find('.js-debias-before-blue-value'),
            'after-blue': this.$el.find('.js-debias-after-blue-value'),
        };
    }

    show() {
        this._renderComparison();

        TweenLite.set('#js-debias-readout', {y: 20, opacity: 0});
        this.$el.removeClass(CLASSES.IS_INACTIVE);
        TweenLite.to('#js-debias-readout', 0.3, {y: 0, opacity: 1, ease: Power1.easeOut});
        this.update();
    }

    // called on every decision the belt makes after the retrain
    update() {
        const decisions = dataModule.getAcceptanceSinceDebias();
        const accepted = decisions.filter((prediction) => prediction[0] == 1).length;
        const reviewed = decisions.length;
        const hireText = accepted === 1 ? '1 hired' : `${accepted} hired`;
        const reviewText = reviewed === 1 ? '1 candidate' : `${reviewed} candidates`;
        this.$note.text(reviewed === 0
            ? 'Watching the belt since the retrain…'
            : `${reviewText} since the retrain, ${hireText}.`);
    }

    _renderComparison() {
        const comparison = dataModule.getPoolComparison();
        if (!comparison) return;

        const total = comparison.before.orange.total + comparison.before.blue.total;
        this.$title.text(`Acceptance across all ${total} applicants`);

        ['orange', 'blue'].forEach((color) => {
            this._renderRate(`before-${color}`, comparison.before[color]);
            this._renderRate(`after-${color}`, comparison.after[color]);
        });
    }

    _renderRate(key, counts) {
        const rate = counts.total ? Math.round(100 * counts.accepted / counts.total) : 0;
        this.$cells[key].css('width', `${rate}%`);
        this.$values[key].text(`${rate}%`);
    }

    hide() {
        this.$el.addClass(CLASSES.IS_INACTIVE);
    }

    destroy() {
        this.hide();
    }
}
