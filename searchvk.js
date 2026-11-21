(function () {
    'use strict';

    var VK_CLIENT_ID = 52461373;
    var VK_API_VERSION = '5.264';
    var PROXY_PREFIX = ''; // Например: 'https://your-cors-proxy.workers.dev/?url=' (оставьте пустым для прямого запроса)

    var cachedToken = null;
    var tokenExpiresAt = 0;

    function wrapUrl(url) {
        if (!PROXY_PREFIX) return url;
        return PROXY_PREFIX + encodeURIComponent(url);
    }

    function requestJson(url, options, onSuccess, onError) {
        var finalUrl = wrapUrl(url);
        var opts = options || {};

        fetch(finalUrl, {
            method: opts.method || 'GET',
            headers: opts.headers || {},
            body: opts.body || undefined
        })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                onSuccess(data);
            })
            .catch(function (err) {
                if (onError) onError(err);
            });
    }

    function getAnonymToken(onSuccess, onError) {
        if (cachedToken && Date.now() < tokenExpiresAt) {
            onSuccess(cachedToken);
            return;
        }

        var url = 'https://login.vk.com/?act=get_anonym_token';
        var body =
            'client_secret=' + encodeURIComponent('o557NLIkAErNhakXrQ7A') +
            '&client_id=' + VK_CLIENT_ID +
            '&scopes=' + encodeURIComponent('audio_anonymous,video_anonymous,photos_anonymous,profile_anonymous') +
            '&isApiOauthAnonymEnabled=false&version=1&app_id=6287487';

        requestJson(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            },
            function (json) {
                var token = json && json.data && json.data.access_token;
                if (!token) {
                    if (onError) onError(new Error('Не удалось получить анонимный токен VK'));
                    return;
                }

                cachedToken = token;
                var expires = (json.data.expires || json.data.expired_at || -1);
                if (expires === -1) {
                    tokenExpiresAt = Date.now() + 9 * 60 * 60 * 1000;
                } else {
                    tokenExpiresAt = Number(expires) * 1000 - 3 * 60 * 60 * 1000;
                }

                onSuccess(cachedToken);
            },
            onError
        );
    }

    function extractQualities(files) {
        if (!files || typeof files !== 'object') return [];

        var order = [
            ['mp4_2160', '2160p'],
            ['mp4_1440', '1440p'],
            ['mp4_1080', '1080p'],
            ['mp4_720', '720p'],
            ['mp4_480', '480p'],
            ['mp4_360', '360p'],
            ['mp4_240', '240p'],
            ['mp4_144', '144p']
        ];

        var list = [];
        for (var i = 0; i < order.length; i++) {
            var key = order[i][0];
            var label = order[i][1];
            if (typeof files[key] === 'string' && files[key].length > 0) {
                list.push({
                    label: label,
                    url: files[key]
                });
            }
        }
        return list;
    }

    function searchVkVideos(query, onSuccess, onError) {
        getAnonymToken(function (token) {
            var url =
                'https://api.vk.com/method/catalog.getVideoSearchWeb2?v=' +
                encodeURIComponent(VK_API_VERSION) +
                '&client_id=' + VK_CLIENT_ID;

            var body =
                'screen_ref=search_video_service' +
                '&input_method=keyboard_search_button' +
                '&q=' + encodeURIComponent(query) +
                '&access_token=' + encodeURIComponent(token);

            requestJson(
                url,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: body
                },
                function (json) {
                    var rawVideos = (json && json.response && json.response.catalog_videos) || [];
                    var items = [];

                    for (var i = 0; i < rawVideos.length; i++) {
                        var v = rawVideos[i] && rawVideos[i].video;
                        if (!v) continue;

                        var qualities = extractQualities(v.files);
                        var durationSec = Number(v.duration || 0);
                        var mins = Math.floor(durationSec / 60);
                        var secs = durationSec % 60;
                        var durationStr = durationSec > 0
                            ? mins + ':' + (secs < 10 ? '0' + secs : secs)
                            : '';

                        items.push({
                            title: v.title || 'Без названия',
                            duration: durationStr,
                            poster: (v.image && v.image[v.image.length - 1] && v.image[v.image.length - 1].url) || '',
                            qualities: qualities,
                            playerUrl: qualities.length ? qualities[0].url : (v.player || '')
                        });
                    }

                    onSuccess(items);
                },
                onError
            );
        }, onError);
    }

    function playVideoItem(videoItem) {
        if (videoItem.qualities && videoItem.qualities.length > 1) {
            Lampa.Select.show({
                title: videoItem.title,
                items: videoItem.qualities.map(function (q) {
                    return {
                        title: q.label,
                        subtitle: q.url,
                        url: q.url
                    };
                }),
                onSelect: function (qItem) {
                    Lampa.Player.play({
                        title: videoItem.title + ' [' + qItem.title + ']',
                        url: qItem.url,
                        poster: videoItem.poster
                    });
                },
                onBack: function () {
                    Lampa.Controller.toggle('content');
                }
            });
            return;
        }

        if (!videoItem.playerUrl) {
            Lampa.Noty.show('У видео нет прямой ссылки или потока');
            return;
        }

        Lampa.Player.play({
            title: videoItem.title,
            url: videoItem.playerUrl,
            poster: videoItem.poster
        });
    }

    function openSearch() {
        Lampa.Input.edit({
            title: 'Поиск в ВК Видео',
            value: '',
            free: true,
            nosave: true
        }, function (query) {
            if (!query || !query.trim()) return;

            Lampa.Loading.start(function () {
                Lampa.Loading.stop();
            });

            searchVkVideos(
                query.trim(),
                function (videos) {
                    Lampa.Loading.stop();

                    if (!videos.length) {
                        Lampa.Noty.show('ВК Видео: ничего не найдено');
                        return;
                    }

                    Lampa.Select.show({
                        title: 'ВК Видео: ' + query.trim(),
                        items: videos.map(function (v) {
                            var badge = v.qualities.length ? v.qualities[0].label : 'embed/link';
                            return {
                                title: v.title,
                                subtitle: (v.duration ? v.duration + ' • ' : '') + badge,
                                video: v
                            };
                        }),
                        onSelect: function (entry) {
                            playVideoItem(entry.video);
                        },
                        onBack: function () {
                            Lampa.Controller.toggle('content');
                        }
                    });
                },
                function (err) {
                    Lampa.Loading.stop();
                    Lampa.Noty.show('Ошибка ВК Видео (возможен CORS): ' + (err && err.message ? err.message : 'ошибка'));
                }
            );
        });
    }

    function init() {
        if (window.lampa_mx_vk_search_ready) return;
        window.lampa_mx_vk_search_ready = true;

        var btn = $('<div class="head__action selector" style="padding: 0 0.8em; display: flex; align-items: center;"><span>ВК Видео</span></div>');
        btn.on('hover:enter click', openSearch);
        $('.head__actions').append(btn);
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
