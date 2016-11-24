/// <reference path="util/util.js" />
/// <reference path="third-party/markerclusterer.js" />
/// <reference path="third-party/google-map.js" />
/// <reference path="third-party/d3.js" />
/// <reference path="third-party/lodash.js" />
/// <reference path="third-party/require.js" />

require.config({
    baseUrl: 'third-party',
    paths: {
        shapefile: '../shapefile',
        util: '../util',
        google_map: 'https://maps.googleapis.com/maps/api/js?key=AIzaSyAS0nUuUJ0wPAHEXOtKst5sJoDl-Vb5CJQ',
        angular: 'https://ajax.googleapis.com/ajax/libs/angularjs/1.5.8/angular.min',
        jquery: 'jquery-3.1.1.min'
    },
    shim: {
        angular: {
            exports: 'angular'
        },        
        'chosen/angular-chosen.min': {
            deps: ['jquery', 'angular', 'chosen/chosen.jquery']
        }
    }
});

require(['jquery', 'angular', 'util/module', 'google_map', 'chosen/angular-chosen.min'],
function ($, angular, util) {
    var app = angular.module("BosNeighborhood", ['localytics.directives']);
    app.controller("BosNeighborhoodController", function ($scope, $timeout) {
        $scope.markers = [];
        $scope.markerCluster = null;
        $scope.region_neighborhood_ht = {};
        // todo: show some stats along with the types "Theft (**19 cases**)"
        $scope.crime_types = ['All'];
        $scope.service_types = ['All'];
        $scope.type_filters = { selected_crime_types: ['All'], selected_service_types: ['All'] };

        $("#crime-type-filter").chosen({ placeholder_text_multiple: 'Select crime types' })
            .change(() => {
                // make sure callback runs in next digest cycle
                // http://stackoverflow.com/questions/29506103/directive-updates-to-parent-scope-one-step-delayed
                $timeout(() => {
                    console.log($scope.type_filters.selected_crime_types);
                    util.render($scope, 'crime');
                });
            });
        $("#service-type-filter").chosen({ placeholder_text_multiple: 'Select 311 types' })
            .change(() => {
                $timeout(() => {
                    console.log($scope.type_filters.selected_service_types);
                    util.render($scope, '311');
                });
            });

        var map = util.initMap($scope);
    });
    angular.bootstrap(document, ['BosNeighborhood']);
});