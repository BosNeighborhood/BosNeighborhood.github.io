define(['d3', 'google_map'], function (d3) {
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

    function requestData(callback) {
        var baseUrl = "https://data.cityofboston.gov/resource/29yf-ye7n.json";
        d3.request(baseUrl)
            .header("X-App-Token", "fa90xHwTH31A8h1WQfskk38cb")
            .get(callback);
    }

    return {
        getZoomByBounds: getZoomByBounds,
        requestData: requestData
    };
});