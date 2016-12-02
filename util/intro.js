define(['jquery', 'intro.js/intro.min'], function ($, introJs) {
    function featureIntroduction(version) {
        if (localStorage.getItem('bos-neighborhood-version') !== version) {
            // first time user use this version, show feature guide
            var tour = introJs();
            tour.setOptions({
                'showBullets': false,
                'tooltipPosition': 'auto',
                'positionPrecedence': ['left', 'right', 'bottom', 'top']
            });
            tour.setOptions({
                steps: [
                  {
                      element: $('#home').get(0),
                      intro: 'Welcome! Please read the introduction'
                  },
                  {
                      element: $('#map').get(0),
                      intro: 'Number shows... Orange... Blue... Click neighborhood...'
                  },
                  {
                      element: $('.filter-top').get(0),
                      intro: "Use type filters to show only things that you're interested in"
                  },
                  {
                      element: $('.filter-bottom').get(0),
                      intro: 'Click and drag the date/time filters to focus on specific time range'
                  }
                ]
            });
            tour.onexit(() => {
                localStorage.setItem('bos-neighborhood-version', version);
            });
            tour.start();
        }
    }

    return {
        featureIntroduction: featureIntroduction
    };
});