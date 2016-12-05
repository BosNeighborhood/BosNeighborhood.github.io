define(['util/util', 'util/init', 'util/render', 'util/intro'], function (util, init, render, intro) {
    return {
        getZoomByBounds: util.getZoomByBounds,
        requestData: util.requestData,
        switchTab: util.switchTab,

        initMap: init.initMap,

        render: render.render,
        initBrush: render.initBrush,
        renderAll: render.renderAll,

        featureIntroduction: intro.featureIntroduction
    };
});