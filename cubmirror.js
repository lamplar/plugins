(function () {
    'use strict';

    var TARGET_DOMAIN = 'cub.black';
    var TARGET_URL = 'https://' + TARGET_DOMAIN + '/';

    function applyDeepCubFix() {
        
        Lampa.Storage.set('cub_domain', TARGET_DOMAIN);

        
        if (window.cub_domain) window.cub_domain = TARGET_URL;
        
        if (window.Lampa) {
            
            if (Lampa.CUB) {
                Lampa.CUB.domain = TARGET_URL;
                Lampa.CUB.mirrors = [TARGET_URL];
            }
            
            if (Lampa.Account) {
                Lampa.Account.url = function (method) {
                    return TARGET_URL + 'api/' + method;
                };
            }

            
            if (Lampa.network && !Lampa.network.cub_patched) {
                
                
                var originalRequest = Lampa.network.request;
                Lampa.network.request = function (url, method, data, onsuccess, onerror, options) {
                    if (typeof url === 'string') {
                        
                        url = url.replace(/https?:\/\/(cub\.best|cub\.watch|cub\.red|cub\.tv|cub\.pw)\//gi, TARGET_URL);
                    } else if (url && typeof url.url === 'string') {
                        url.url = url.url.replace(/https?:\/\/(cub\.best|cub\.watch|cub\.red|cub\.tv|cub\.pw)\//gi, TARGET_URL);
                    }
                    return originalRequest.apply(this, arguments);
                };

                
                var originalSilent = Lampa.network.silent;
                if (originalSilent) {
                    Lampa.network.silent = function (url, onsuccess, onerror) {
                        if (typeof url === 'string') {
                            url = url.replace(/https?:\/\/(cub\.best|cub\.watch|cub\.red|cub\.tv|cub\.pw)\//gi, TARGET_URL);
                        }
                        return originalSilent.apply(this, arguments);
                    };
                }

                Lampa.network.cub_patched = true;
            }
        }
    }

    
    applyDeepCubFix();

    
    
    if (window.appready) {
        applyDeepCubFix();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') applyDeepCubFix();
        });
    }
})();
