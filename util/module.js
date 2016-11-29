define(['util/util', 'util/init', 'util/render'], function (util, init, render) {
    return {
        getZoomByBounds: util.getZoomByBounds,
        requestData: util.requestData,
        addEventListeners: util.addEventListeners,

        initMap: init.initMap,

        render: render.render,
        initBrush: render.initBrush
    };
});