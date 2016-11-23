/// <reference path="util/util.js" />
/// <reference path="third-party/markerclusterer.js" />
/// <reference path="third-party/google-map.js" />
/// <reference path="third-party/d3.js" />
/// <reference path="third-party/lodash.js" />
/// <reference path="third-party/require.js" />

requirejs.config({
    baseUrl: 'third-party',
    paths: {
        shapefile: '../shapefile',
        util: '../util',
        jquery: 'https://code.jquery.com/jquery-3.1.1.min',
        google_map: 'https://maps.googleapis.com/maps/api/js?key=AIzaSyAS0nUuUJ0wPAHEXOtKst5sJoDl-Vb5CJQ'
    }
});

require(['lodash', 'd3', 'jquery', 'shapefile/boston_neighborhoods.js', 'util/util', 'google_map', 'markerclusterer'],
function (_, d3, $, neighborhoods_shape, util) {
    var map;    

    function initMap() {       
        new google.maps.Geocoder().geocode({ 'address': "Boston" }, (results, status) => {
            var region_neighborhood_ht = {};

            // todo: retry if status is not OK
            if (status == google.maps.GeocoderStatus.OK) {
                var bos_lat = results[0].geometry.location.lat(),
                    bos_lng = results[0].geometry.location.lng();

                // todo: hide unneccesary things on map (highways, map/satelite etc)            
                map = new google.maps.Map(document.getElementById('map'), {
                    center: { lat: bos_lat, lng: bos_lng },
                    zoom: 10
                });
                map.fitBounds(results[0].geometry.bounds);
                // triger event on every change of viewport
                // todo: efficiency
                // todo: limit zoom/pan level/area cannot move outside bos
                google.maps.event.addListener(map, 'idle', () => {
                    var bounds = map.getBounds();
                    var ne = bounds.getNorthEast(); // LatLng of the north-east corner
                    var sw = bounds.getSouthWest(); // LatLng of the south-west corder
                    var nw = new google.maps.LatLng(ne.lat(), sw.lng());
                    var se = new google.maps.LatLng(sw.lat(), ne.lng());
                });
                // load neighborhood borders, register to events            
                _.forEach(neighborhoods_shape.features, neighborhood => {
                    if (neighborhood.geometry.type === "Polygon") {
                        neighborhood.geometry.coordinates = [neighborhood.geometry.coordinates];
                    }
                    _.forEach(neighborhood.geometry.coordinates, polygons => {
                        _.forEach(polygons, polygon => {
                            var region = new google.maps.Polygon({
                                map: map,
                                paths: _.map(polygon, point => new google.maps.LatLng(+point[1], +point[0])),
                                // todo: style
                                strokeColor: '#ff0000',
                                strokeOpacity: 0.8,
                                strokeWeight: 2,
                                fillColor: '#ff0000',
                                fillOpacity: 0.5
                            });
                            if (!_.has(region_neighborhood_ht, neighborhood.properties.Name)) {
                                region_neighborhood_ht[neighborhood.properties.Name] = [];
                            }
                            region_neighborhood_ht[neighborhood.properties.Name].push(region);
                            google.maps.event.addListener(region, 'click', function (event) {
                                _.forOwn(region_neighborhood_ht, (value, key) => {
                                    if (value.indexOf(this) !== -1) {
                                        // todo: update sidebar etc.
                                        //alert(key);
                                    }
                                });
                                map.setCenter(this.getBounds().getCenter());
                                map.setZoom(util.getZoomByBounds(map, this.getBounds()));
                            });
                            google.maps.event.addListener(region, 'mouseover', function (event) {
                                // Within the event listener, "this" refers to the polygon which
                                // received the event.
                                this.setOptions({
                                    strokeColor: '#00ff00',
                                    fillColor: '#00ff00'
                                });
                            });
                            google.maps.event.addListener(region, 'mouseout', function (event) {
                                this.setOptions({
                                    strokeColor: '#ff0000',
                                    fillColor: '#ff0000'
                                });
                            });
                        });
                    });
                });
                // load crime data, create marker cluster
                util.requestData((error, response) => {
                    if (error) {
                        console.log(error);
                    }
                    var data = JSON.parse(response.response);
                    var markers = _(data).map(record => new google.maps.Marker({
                        position: { lat: +record.lat, lng: +record.long },
                        // todo: actual label
                        label: "TBD"
                    })).value();
                    var markerCluster = new MarkerClusterer(map, markers, { imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m' });
                });
            }
        });
    }
    initMap();    
});