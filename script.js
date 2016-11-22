/// <reference path="third-party/markerclusterer.js" />
/// <reference path="third-party/google-map.js" />
/// <reference path="third-party/d3.js" />
/// <reference path="third-party/lodash.js" />

var map;
function initMap() {
    new google.maps.Geocoder().geocode({ 'address': "Boston" }, (results, status) => {
        if (status == google.maps.GeocoderStatus.OK) {
            var bos_lat = results[0].geometry.location.lat(),
                bos_lng = results[0].geometry.location.lng();

            // todo: hide unneccesary things on map (highways etc)
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
            
            requestData((error, response) => {
                if (error) {
                    console.log(error);
                }
                var data = JSON.parse(response.response);
                var markers = _(data).map(record => new google.maps.Marker({
                    position: { lat: +record.lat, lng: +record.long },
                    label: "TBD"
                })).value();
                var markerCluster = new MarkerClusterer(map, markers, {imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'});
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