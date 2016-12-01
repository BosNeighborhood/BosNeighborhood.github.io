// similiar to angular's debounce in ngModelOptions
// todo: make it generic, research closure
define([], function () {
    class Debounce {        
        static observed(filterType, $scope) {
            if (this.timeoutId[filterType]) {
                this.cancel(filterType);
            }

            this.scope = $scope;
            this.timeoutId[filterType] = setTimeout(this.accept.bind(this), 500, filterType);            
        }

        static cancel(filterType) {
            clearTimeout(this.timeoutId[filterType]);
            this.timeoutId[filterType] = undefined;
        }

        static accept(filterType) {
            this.scope.$emit('debounceAccept', filterType);
            this.timeoutId[filterType] = undefined;
        }
    }

    Debounce.timeoutId = {};
    return Debounce;
});