define([], function () {
    class Progress {
        static start() {
            // show progress bar
            this.container.style.visibility = 'initial';
            this.bar.style.width = '1%';
        }

        static report(percent) {
            if (percent < 0) percent = 0;
            if (percent > 100) percent = 100;
            //console.log('progress: ' + percent + '%');
            this.bar.style.width = percent + '%';
        }

        static complete() {
            this.bar.style.width = '100%';
            setTimeout(() => { this.container.style.visibility = 'hidden'; }, 100);
        }
    };

    Progress.container = document.getElementById("progress-container");
    Progress.bar = document.getElementById("progress-bar");

    return Progress;
});