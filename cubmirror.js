(function() {
    'use strict';

    Lampa.Listener.follow('request_before', function(e) {
        if (e.params && e.params.url) {
            var url = e.params.url;

            // 1. Постеры и картинки (TMDB) перехватываем на cub.best
            if (/^https?:\/\/(api)?tmdb\.cub\.[a-z]+/i.test(url)) {
                e.params.url = url.replace(/^(https?:\/\/(?:api)?tmdb\.cub\.)[a-z]+/i, '$1best');
            }
            // 2. ТОЛЬКО запросы к API (фильмы, аккаунт, закладки) кидаем на cub.black
            // Ищем строку вида "cub.что-то/api/"
            else if (/^https?:\/\/cub\.[a-z]+\/api\//i.test(url)) {
                e.params.url = url.replace(/^https?:\/\/cub\.[a-z]+/i, 'https://cub.black');
            }
        }
    });

})();
