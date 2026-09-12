(function () {
    'use strict';

    function applyCubFix() {
        
        Lampa.Storage.set('cub_domain', 'cub.black');

        
        window.cub_domain = 'https://cub.black/';

        
        if (window.Lampa && Lampa.CUB) {
            Lampa.CUB.domain = 'https://cub.black/';
            if (Array.isArray(Lampa.CUB.mirrors)) {
                Lampa.CUB.mirrors = ['https://cub.black/'];
            }
        }

        
        if (window.Lampa && Lampa.Account) {
            Lampa.Account.url = function (method) {
                return 'https://cub.black/api/' + method;
            };
        }
    }

    
    applyCubFix();
    if (window.appready) {
        applyCubFix();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') applyCubFix();
        });
    }
})();
