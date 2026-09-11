(function () {
    'use me strict';

    function initPlugin() {
    
        Lampa.Storage.set('cub_domain', 'cub.black');

    
        if (window.cub_domain) {
            window.cub_domain = 'https://cub.black/';
        }

  
        if (Lampa.CUB && Lampa.CUB.mac) {
            Lampa.CUB.domain = 'https://cub.black/';
        }

    
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                if (Lampa.Account && Lampa.Account.url) {
                    Lampa.Account.url = function (method) {
                        return 'https://cub.black/api/' + method;
                    };
                }
            }
        });
    }

    if (window.appready) {
        initPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') initPlugin();
        });
    }
})();
