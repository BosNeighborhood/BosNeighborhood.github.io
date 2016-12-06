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
                      intro: 'Welcome, new Bostonians! Explore our new features!'
                  },
                  {
                      element: $('#map').get(0),
                      intro: 'The map shows you all neighborhoods in Boston. The number on blue circles showing 311 Non-emergency Services cases happened on this area. While yellow ones indicating crime cases.'
                  },
                  {
                      element: $('.filter-top').get(0),
                      intro: "Type or click an issue you care about, and see what the status is in a particular area."
                  },
                  {
                      element: $('.filter-bottom').get(0),
                      intro: 'Drag the filter to see a particular time period.'
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
