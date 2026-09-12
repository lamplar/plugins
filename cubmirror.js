(function () {
    'use strict';

    function initUltimateCubFix() {
        // Защита от двойного запуска
        if (!window.Lampa || !Lampa.network || Lampa.network.cub_black_patched) return;

        // Функция подмены адресов на лету
        function fixUrl(urlStr) {
            if (!urlStr) return urlStr;
            
            // 1. Постеры и картинки (TMDB proxy): направляем на cub.best
            if (/^https?:\/\/(api)?tmdb\.cub\.[a-z]+/i.test(urlStr)) {
                // Сохраняем начало (tmdb или apitmdb) и меняем только конец на .best
                return urlStr.replace(/^(https?:\/\/(?:api)?tmdb\.cub\.)[a-z]+/i, '$1best');
            }
            
            // 2. Страницы фильмов, сериалов, комментарии и аккаунт: направляем на cub.black
            if (/^https?:\/\/cub\.[a-z]+/i.test(urlStr)) {
                return urlStr.replace(/^https?:\/\/cub\.[a-z]+/i, 'https://cub.black');
            }
            
            return urlStr;
        }

        // Перехватываем стандартные запросы
        var originalRequest = Lampa.network.request;
        Lampa.network.request = function (url, method, data, onsuccess, onerror, options) {
            if (typeof url === 'string') {
                url = fixUrl(url);
            } else if (url && url.url) {
                url.url = fixUrl(url.url);
            }
            return originalRequest.apply(this, arguments);
        };

        // Перехватываем фоновые запросы (например, отметки о просмотре)
        var originalSilent = Lampa.network.silent;
        if (originalSilent) {
            Lampa.network.silent = function (url, onsuccess, onerror) {
                if (typeof url === 'string') {
                    url = fixUrl(url);
                } else if (url && url.url) {
                    url.url = fixUrl(url.url);
                }
                return originalSilent.apply(this, arguments);
            };
        }

        Lampa.network.cub_black_patched = true; // Ставим метку
    }

    // Запускаем при полной загрузке
    if (window.appready) {
        initUltimateCubFix();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') initUltimateCubFix();
        });
    }
})();
