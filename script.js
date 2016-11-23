/// <reference path="third-party/markerclusterer.js" />
/// <reference path="third-party/google-map.js" />
/// <reference path="third-party/d3.js" />
/// <reference path="third-party/lodash.js" />

var map;

function initMap() {
    if (!google.maps.Polygon.prototype.getBounds) {
        google.maps.Polygon.prototype.getBounds = function () {
            var bounds = new google.maps.LatLngBounds()
            this.getPath().forEach(function (element, index) { bounds.extend(element) })
            return bounds
        }
    }
    /**
    * Returns the zoom level at which the given rectangular region fits in the map view. 
    * The zoom level is computed for the currently selected map type. 
    * @param {google.maps.Map} map
    * @param {google.maps.LatLngBounds} bounds 
    * @return {Number} zoom level
    **/
    // http://stackoverflow.com/questions/9837017/equivalent-of-getboundszoomlevel-in-gmaps-api-3
    function getZoomByBounds(map, bounds) {
        var MAX_ZOOM = map.mapTypes.get(map.getMapTypeId()).maxZoom || 21;
        var MIN_ZOOM = map.mapTypes.get(map.getMapTypeId()).minZoom || 0;

        var ne = map.getProjection().fromLatLngToPoint(bounds.getNorthEast());
        var sw = map.getProjection().fromLatLngToPoint(bounds.getSouthWest());

        var worldCoordWidth = Math.abs(ne.x - sw.x);
        var worldCoordHeight = Math.abs(ne.y - sw.y);

        //Fit padding in pixels 
        var FIT_PAD = 40;

        for (var zoom = MAX_ZOOM; zoom >= MIN_ZOOM; --zoom) {
            if (worldCoordWidth * (1 << zoom) + 2 * FIT_PAD < $(map.getDiv()).width() &&
                worldCoordHeight * (1 << zoom) + 2 * FIT_PAD < $(map.getDiv()).height())
                return zoom;
        }
        return 0;
    }

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
                            map.setZoom(getZoomByBounds(map, this.getBounds()));
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
            requestData((error, response) => {
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

function requestData(callback) {
    var baseUrl = "https://data.cityofboston.gov/resource/29yf-ye7n.json";
    d3.request(baseUrl)
        .header("X-App-Token", "fa90xHwTH31A8h1WQfskk38cb")
        .get(callback);
}