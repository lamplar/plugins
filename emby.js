(function() {
    'use strict';

    const PLUGIN_NAME = 'Emby';
    const PLUGIN_VERSION = '1.0.4';

    const STORAGE_URL = 'emby_url';
    const STORAGE_API_KEY = 'emby_api_key';
    const STORAGE_USERNAME = 'emby_username';
    const STORAGE_PASSWORD = 'emby_password';
    const STORAGE_ACCESS_TOKEN = 'emby_access_token';
    const STORAGE_USER_ID = 'emby_user_id';

    // ---- Регистрируем стандартный шаблон для серий ----
    Lampa.Template.add('online_prestige_full', `
        <div class="online-prestige online-prestige--full selector">
            <div class="online-prestige__img">
                <img alt="">
                <div class="online-prestige__loader"></div>
            </div>
            <div class="online-prestige__body">
                <div class="online-prestige__head">
                    <div class="online-prestige__title">{title}</div>
                    <div class="online-prestige__time">{time}</div>
                </div>
                <div class="online-prestige__timeline"></div>
                <div class="online-prestige__footer">
                    <div class="online-prestige__info">{info}</div>
                    <div class="online-prestige__quality">{quality}</div>
                </div>
            </div>
        </div>
    `);

    // ---- Стили ----
    if (!$('style#emby-plugin-styles').length) {
        $('head').append(`
            <style id="emby-plugin-styles">
                .emby-filter-btn { background: rgba(255,255,255,0.1); padding: 0.6em 1.5em; border-radius: 5px; cursor: pointer; font-size: 1.1em; font-weight: bold; transition: background 0.3s; }
                .emby-filter-btn.focus { background: #fff; color: #000; }
                .emby-loader { display: flex; justify-content: center; align-items: center; height: 10em; flex-grow: 1; }
                .emby-loader-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 100; display: flex; justify-content: center; align-items: center; border-radius: 10px; } 
                .emby-empty { text-align: center; padding: 3em; font-size: 1.2em; opacity: 0.7; width: 100%; }
                .online-prestige { margin: 0.5em 1em; }
                .online-prestige.focus::after { top: -0.3em; left: -0.3em; right: -0.3em; bottom: -0.3em; }
            </style>
        `);
    }

    // ---- Базовые функции ----
    function getUrl() { return (Lampa.Storage.get(STORAGE_URL, '') || '').trim(); }
    function getApiKey() { return (Lampa.Storage.get(STORAGE_API_KEY, '') || '').trim(); }
    function getUsername() { return (Lampa.Storage.get(STORAGE_USERNAME, '') || '').trim(); }
    function getPassword() { return Lampa.Storage.get(STORAGE_PASSWORD, '') || ''; }
    function getAccessToken() { return (Lampa.Storage.get(STORAGE_ACCESS_TOKEN, '') || '').trim(); }
    function getUserId() { return (Lampa.Storage.get(STORAGE_USER_ID, '') || '').trim(); }
    function hasLogin() { return getUsername().length > 0 && getPassword().length > 0; }
    function isConfigured() {
        return getUrl().length > 5 && (getApiKey().length > 0 || hasLogin() || getAccessToken().length > 0);
    }
    function notify(msg) { Lampa.Noty.show(msg); }
    function getApiCredential() {
        return hasLogin() ? getAccessToken() : (getApiKey() || getAccessToken());
    }

    // Проверка на устройства Apple
    const isApple = (typeof Lampa !== 'undefined' && Lampa.Platform.is('apple')) || 
                    /Mac|iPhone|iPod|iPad|AppleTV/i.test(navigator.userAgent);

    // Очистка объекта movie от циклических ссылок (DOM-элементов) Lampa
    function sanitizeMovie(m) {
        if (!m) return null;
        return {
            id: m.id,
            tmdb_id: m.tmdb_id,
            title: m.title,
            name: m.name,
            original_title: m.original_title,
            original_name: m.original_name,
            number_of_seasons: m.number_of_seasons
        };
    }

    function buildApiUrl(endpoint) {
        const base = getUrl().replace(/\/$/, '');
        const sep = endpoint.includes('?') ? '&' : '?';
        const credential = getApiCredential();
        return `${base}/emby${endpoint}${sep}api_key=${encodeURIComponent(credential)}`;
    }

    function buildImageUrl(itemId, imageTag) {
        const base = getUrl().replace(/\/$/, '');
        return `${base}/emby/Items/${itemId}/Images/Primary?tag=${encodeURIComponent(imageTag)}&api_key=${encodeURIComponent(getApiCredential())}`;
    }

    function authenticate(callback) {
        if (!hasLogin()) {
            callback(true);
            return;
        }

        const base = getUrl().replace(/\/$/, '');
        const deviceName = (navigator.userAgent || 'Lampa').replace(/["\\]/g, '');
        const authorization = 'MediaBrowser Client="Lampa", Device="' + deviceName +
            '", DeviceId="' + getDeviceId() + '", Version="' + PLUGIN_VERSION + '"';
        const xhr = new XMLHttpRequest();

        xhr.open('POST', base + '/emby/Users/AuthenticateByName', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-Emby-Authorization', authorization);
        xhr.timeout = 15000;
        xhr.onload = function() {
            let result;
            try {
                result = JSON.parse(xhr.responseText);
            } catch (e) {
                result = null;
            }

            if (xhr.status >= 200 && xhr.status < 300 && result && result.AccessToken) {
                Lampa.Storage.set(STORAGE_ACCESS_TOKEN, result.AccessToken);
                if (result.User && result.User.Id)
                    Lampa.Storage.set(STORAGE_USER_ID, result.User.Id);
                callback(true);
            } else {
                callback(false, xhr.status ? 'HTTP ' + xhr.status : 'не удалось разобрать ответ сервера');
            }
        };
        xhr.onerror = function() { callback(false, 'ошибка сети или CORS'); };
        xhr.ontimeout = function() { callback(false, 'истекло время ожидания'); };
        xhr.send(JSON.stringify({
            Username: getUsername(),
            Pw: getPassword()
        }));
    }

    function getDeviceId() {
        let deviceId = Lampa.Storage.get('emby_device_id');
        if (!deviceId) {
            deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            Lampa.Storage.set('emby_device_id', deviceId);
        }
        return deviceId;
    }

    function extractTmdbId(movie) {
        if (!movie) return null;
        let tmdb = movie.tmdb_id || movie.id;
        if (typeof movie.url === 'string') {
            let match = movie.url.match(/tv\/(\d+)/);
            if (match) tmdb = parseInt(match[1]);
        }
        if (!tmdb && movie.data) {
            tmdb = movie.data.tmdb_id || movie.data.id;
        }
        if (typeof tmdb === 'string' && !isNaN(tmdb)) {
            tmdb = parseInt(tmdb);
        }
        return tmdb;
    }

    function markHistoryAndWatch(movie, season, episode) {
        if (!movie) return;

        Lampa.Favorite.add('history', movie, 100);

        if (season && episode) {
            var titleForHash = movie.number_of_seasons ? (movie.original_name || movie.name) : (movie.original_title || movie.title);
            if (!titleForHash) titleForHash = movie.title || '';
            
            var file_id = Lampa.Utils.hash(titleForHash);
            var watched = Lampa.Storage.cache('online_watched_last', 5000, {});
            
            if (!watched[file_id]) {
                watched[file_id] = {};
            }
            
            Lampa.Arrays.extend(watched[file_id], {
                balanser: 'emby',
                balanser_name: 'Emby',
                season: parseInt(season),
                episode: parseInt(episode)
            }, true);
            
            Lampa.Storage.set('online_watched_last', watched);
        }
    }

    function findInEmby(movie, callback) {
        if (!movie) return callback(null);
        let tmdb = extractTmdbId(movie);
        let network = new (Lampa.Request || Lampa.Reguest)();
        if (tmdb) {
            network.silent(buildApiUrl(`/Items?AnyProviderIdEquals=tmdb.${tmdb}&Recursive=true&IncludeItemTypes=Movie,Series&Fields=Id,Type,Name,Container`), (data) => {
                callback((data && data.Items && data.Items[0]) || null);
            }, () => callback(null));
        } else {
            const title = movie.title || movie.name || movie.original_title || movie.original_name || '';
            if (!title) return callback(null);
            network.silent(buildApiUrl(`/Items?SearchTerm=${encodeURIComponent(title)}&Limit=3&Recursive=true&IncludeItemTypes=Movie,Series&Fields=Id,Type,Name,Container`), (data) => {
                callback((data && data.Items && data.Items[0]) || null);
            }, () => callback(null));
        }
    }

    function getSeasonsFromTMDB(tmdb_id, callback) {
        if (!tmdb_id) { callback([]); return; }
        let network = new (Lampa.Request || Lampa.Reguest)();
        let url = Lampa.TMDB.api('tv/' + tmdb_id + '?api_key=' + Lampa.TMDB.key() + '&language=' + Lampa.Storage.get('language', 'ru'));
        network.silent(url, (data) => {
            if (data && data.seasons) {
                callback(data.seasons.filter(s => s.season_number > 0));
            } else {
                callback([]);
            }
        }, () => callback([]));
    }

    function getEpisodesFromTMDB(tmdb_id, season_number, callback) {
        if (!tmdb_id) { callback([]); return; }
        let network = new (Lampa.Request || Lampa.Reguest)();
        let url = Lampa.TMDB.api('tv/' + tmdb_id + '/season/' + season_number + '?api_key=' + Lampa.TMDB.key() + '&language=' + Lampa.Storage.get('language', 'ru'));
        network.silent(url, (data) => {
            if (data && data.episodes) {
                callback(data.episodes);
            } else {
                callback([]);
            }
        }, () => callback([]));
    }

    function buildStreamUrl(itemId, container = 'mp4') {
        const base = getUrl().replace(/\/$/, '');
        return `${base}/emby/Videos/${itemId}/stream.${container}?Static=true&DeviceId=${getDeviceId()}&PlaySessionId=${Date.now()}&api_key=${encodeURIComponent(getApiCredential())}`;
    }

    function playMovie(item, movie) {
        const titleForHash = movie ? (movie.original_title || movie.original_name || movie.title || movie.name) : item.Name;
        const timelineKey = Lampa.Utils.hash(titleForHash);
        
        let container = item.Container ? item.Container.split(',')[0] : 'mp4';
        
        let playObj = {
            title: item.Name,
            url: buildStreamUrl(item.Id, container),
            poster: item.PrimaryImageTag ? buildImageUrl(item.Id, item.PrimaryImageTag) : '',
            timeline: Lampa.Timeline.view(timelineKey),
            movie: sanitizeMovie(movie) // Очищаем данные фильма
        };
        
        // Костыль для Apple TV - используем копию объекта для предотвращения циклической ссылки
        if (isApple) {
            playObj.playlist = [{ ...playObj }]; 
        }

        markHistoryAndWatch(movie, null, null);

        Lampa.Player.play(playObj);
        
        if (isApple) {
            Lampa.Player.playlist(playObj.playlist);
        } else {
            Lampa.Player.playlist([playObj]);
        }
    }

    function EmbyLibraryComponent(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var explorer = new Lampa.Explorer(object);
        var destroyed = false;
        var lastFocused = false;
        var stage = object && object.stage || 'items';
        var series = object && object.series;
        var season = object && object.season;
        var offset = 0;
        var totalCount = 0;
        var loading = false;

        this.create = function() {
            explorer.appendFiles(scroll.render());
            scroll.body().addClass('torrent-list');
        };

        this.start = function() {
            loadItems();
        };

        function loadItems(append) {
            if (destroyed || loading) return;
            loading = true;
            if (!append) {
                offset = 0;
                totalCount = 0;
                scroll.clear();
                scroll.append($('<div class="emby-loader"><div class="broadcast__spin"></div></div>'));
            } else {
                scroll.render().find('.emby-load-more').remove();
            }

            var endpoint;
            if (stage === 'seasons') {
                endpoint = '/Shows/' + encodeURIComponent(series.Id) + '/Seasons?Fields=Id,Name,IndexNumber,PrimaryImageTag' +
                    '&StartIndex=' + offset + '&Limit=100';
                if (getUserId()) endpoint += '&UserId=' + encodeURIComponent(getUserId());
            } else if (stage === 'episodes') {
                endpoint = '/Shows/' + encodeURIComponent(series.Id) + '/Episodes?SeasonId=' +
                    encodeURIComponent(season.Id) +
                    '&Fields=Id,Type,Name,IndexNumber,ParentIndexNumber,PrimaryImageTag,Container' +
                    '&SortBy=SortName&SortOrder=Ascending&StartIndex=' + offset + '&Limit=100';
                if (getUserId()) endpoint += '&UserId=' + encodeURIComponent(getUserId());
            } else {
                var fields = 'Id,Type,Name,ProductionYear,PrimaryImageTag,Container,ProviderIds,IndexNumber';
                endpoint = (getUserId() ? '/Users/' + encodeURIComponent(getUserId()) + '/Items' : '/Items') +
                    '?Recursive=true&IncludeItemTypes=Movie,Series&Fields=' + fields +
                    '&SortBy=SortName&SortOrder=Ascending&StartIndex=' + offset + '&Limit=100';
            }

            network.silent(buildApiUrl(endpoint), function(data) {
                loading = false;
                if (destroyed) return;
                var items = (data && data.Items) || [];
                totalCount = (data && data.TotalRecordCount) || offset + items.length;
                offset += items.length;
                renderItems(items, append);
            }, function() {
                loading = false;
                if (destroyed) return;
                if (!append) {
                    scroll.clear();
                    scroll.append($('<div class="emby-empty">Не удалось загрузить медиатеку Emby</div>'));
                    setupNavigation();
                } else {
                    notify('Не удалось загрузить следующую страницу медиатеки');
                    addLoadMoreButton();
                }
            });
        }

        function renderItems(items, append) {
            if (!append) scroll.clear();
            if (!items.length) {
                if (!append) scroll.append($('<div class="emby-empty">В этом разделе ничего нет</div>'));
                setupNavigation();
                return;
            }

            items.forEach(function(entry) {
                var title = entry.Name || (stage === 'seasons' ? 'Сезон ' + entry.IndexNumber : 'Без названия');
                var details = stage === 'items'
                    ? (entry.Type === 'Series' ? 'Сериал' : 'Фильм') + (entry.ProductionYear ? ' · ' + entry.ProductionYear : '')
                    : stage === 'seasons' ? 'Сезон ' + (entry.IndexNumber || '') : 'Эпизод ' + (entry.IndexNumber || '');
                var row = Lampa.Template.get('online_prestige_full', {
                    title: title,
                    time: '',
                    info: details,
                    quality: ''
                });

                if (entry.PrimaryImageTag) {
                    var image = row.find('img')[0];
                    image.onload = function() {
                        row.find('.online-prestige__img').addClass('online-prestige__img--loaded');
                        row.find('.online-prestige__loader').remove();
                    };
                    image.onerror = function() { image.src = './img/img_broken.svg'; };
                    image.src = buildImageUrl(entry.Id, entry.PrimaryImageTag);
                } else {
                    row.find('img').attr('src', './img/img_broken.svg');
                    row.find('.online-prestige__loader').remove();
                }

                row.on('hover:focus', function() {
                    lastFocused = this;
                    scroll.update($(this), true);
                });
                row.on('hover:enter click', function() { openItem(entry); });
                scroll.append(row);
            });

            if (offset < totalCount) addLoadMoreButton();
            setupNavigation();
            Lampa.Controller.enable('content');
        }

        function addLoadMoreButton() {
            var button = $('<div class="emby-filter-btn selector emby-load-more">Загрузить ещё</div>');
            button.on('hover:focus', function() {
                lastFocused = this;
                scroll.update($(this), true);
            });
            button.on('hover:enter click', function() { loadItems(true); });
            scroll.append(button);
        }

        function openItem(entry) {
            if (stage === 'items' && entry.Type === 'Movie') {
                playMovie(entry, makeMovie(entry));
            } else if (stage === 'items' && entry.Type === 'Series') {
                pushLibrary({ stage: 'seasons', series: entry, title: entry.Name });
            } else if (stage === 'seasons') {
                pushLibrary({ stage: 'episodes', series: series, season: entry, title: entry.Name });
            } else if (stage === 'episodes') {
                playEpisode(entry);
            }
        }

        function makeMovie(entry) {
            var tmdbId = entry.ProviderIds && (entry.ProviderIds.Tmdb || entry.ProviderIds.tmdb);
            return {
                id: tmdbId || entry.Id,
                tmdb_id: tmdbId || null,
                title: entry.Name,
                name: entry.Name,
                original_title: entry.Name,
                original_name: entry.Name,
                number_of_seasons: entry.Type === 'Series' ? 1 : 0
            };
        }

        function playEpisode(entry) {
            var movie = makeMovie(series);
            var seasonNumber = season.IndexNumber || 0;
            var episodeNumber = entry.IndexNumber || 0;
            var title = movie.original_name || movie.name || entry.Name;
            var container = entry.Container ? entry.Container.split(',')[0] : 'mp4';
            var playObject = {
                title: entry.Name,
                url: buildStreamUrl(entry.Id, container),
                poster: entry.PrimaryImageTag ? buildImageUrl(entry.Id, entry.PrimaryImageTag) : '',
                timeline: Lampa.Timeline.view(Lampa.Utils.hash([seasonNumber, episodeNumber, title].join(''))),
                movie: sanitizeMovie(movie),
                season: seasonNumber,
                episode: episodeNumber
            };

            markHistoryAndWatch(movie, seasonNumber, episodeNumber);
            if (isApple) playObject.playlist = [{ ...playObject }];
            Lampa.Player.play(playObject);
            Lampa.Player.playlist(isApple ? playObject.playlist : [playObject]);
        }

        function pushLibrary(params) {
            Lampa.Activity.push({
                title: params.title || 'Медиатека Emby',
                component: 'emby_library',
                object: params
            });
        }

        function setupNavigation() {
            Lampa.Controller.add('content', {
                toggle: function() {
                    Lampa.Controller.collectionSet(scroll.render(), explorer.render());
                    Lampa.Controller.collectionFocus(lastFocused || false, scroll.render());
                },
                up: function() {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function() {
                    if (Navigator.canmove('down')) Navigator.move('down');
                },
                right: function() {
                    if (Navigator.canmove('right')) Navigator.move('right');
                },
                left: function() {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                back: function() { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        }

        this.render = function() { return explorer.render(); };
        this.destroy = function() {
            destroyed = true;
            network.clear();
            scroll.destroy();
            explorer.destroy();
        };
    }

    /* --- КОМПОНЕНТ СЕРИАЛОВ --- */
    function EmbySeriesComponent(object) {
        var network = new (Lampa.Request || Lampa.Reguest)();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var explorer = new Lampa.Explorer(object); 
        var is_destroyed = false;
        
        var filterPanel = $('<div class="explorer__files-head" style="padding: 1.5em; display: flex; align-items: center; gap: 1em;"></div>');
        var seasonBtn = $('<div class="emby-filter-btn selector">Сезон</div>');
        
        var seasons = [];
        var current_season = null;
        var current_episodes = [];
        var emby_series_id = null;
        var tmdb_id = null;
        var last_focused = false; 

        this.create = function() {
            if (object && object.emby_id) emby_series_id = object.emby_id;
            if (object && object.tmdb_id) tmdb_id = object.tmdb_id;
            if (!emby_series_id || !tmdb_id) {
                if (window.embySeriesData) {
                    emby_series_id = window.embySeriesData.emby_id;
                    tmdb_id = window.embySeriesData.tmdb_id;
                }
            }
            if (!tmdb_id && object && object.movie) {
                tmdb_id = extractTmdbId(object.movie);
            }

            seasonBtn.on('hover:enter click', function() {
                showSeasonSelector();
            });
            filterPanel.append(seasonBtn);

            explorer.appendFiles(scroll.render());
            explorer.appendHead(filterPanel);
            
            scroll.body().addClass('torrent-list'); 
            scroll.minus(filterPanel);
        };

        this.start = function() {
            scroll.clear();
            if (!tmdb_id) {
                scroll.append($('<div class="emby-empty">Не удалось определить TMDB ID сериала</div>'));
                setupNavigation();
                return;
            }

            scroll.append($('<div class="emby-loader"><div class="broadcast__spin"></div></div>'));
            
            getSeasonsFromTMDB(tmdb_id, function(result) {
                if (is_destroyed) return;
                seasons = result;
                if (seasons.length === 0) {
                    scroll.clear();
                    scroll.append($('<div class="emby-empty">Сезоны не найдены</div>'));
                    setupNavigation();
                } else {
                    var savedSeason = window.embyLastSeason;
                    if (savedSeason && savedSeason.seriesId === emby_series_id) {
                        var found = seasons.find(function(s) { return s.season_number === savedSeason.seasonNumber; });
                        current_season = found || seasons[0];
                    } else {
                        current_season = seasons[0];
                    }
                    updateSeasonBtn();
                    loadEpisodes();
                }
            });
        };

        function updateSeasonBtn() {
            if (seasonBtn) {
                seasonBtn.text(current_season.name || 'Сезон ' + current_season.season_number);
            }
        }

        function showSeasonSelector() {
            if (!seasons.length) return;
            var items = seasons.map(function(s) {
                return {
                    title: s.name || 'Сезон ' + s.season_number,
                    season: s,
                    selected: s.season_number === current_season.season_number
                };
            });
            Lampa.Select.show({
                title: Lampa.Lang.translate('torrent_serial_season'),
                items: items,
                onSelect: function(a) {
                    current_season = a.season;
                    updateSeasonBtn();
                    window.embyLastSeason = { seriesId: emby_series_id, seasonNumber: current_season.season_number };
                    loadEpisodes();
                },
                onBack: function() {
                    Lampa.Controller.toggle('content');
                }
            });
        }

        function loadEpisodes() {
            if (is_destroyed) return;
            scroll.clear();
            scroll.append($('<div class="emby-loader"><div class="broadcast__spin"></div></div>'));
            
            getEpisodesFromTMDB(tmdb_id, current_season.season_number, function(episodes) {
                if (is_destroyed) return;
                current_episodes = episodes;
                renderEpisodes();
            });
        }

        function renderEpisodes() {
            if (is_destroyed) return;
            scroll.clear();

            if (current_episodes.length === 0) {
                scroll.append($('<div class="emby-empty">Эпизоды не найдены</div>'));
            } else {
                current_episodes.forEach(function(episode, index) {
                    var epNum = String(episode.episode_number).padStart(2, '0');
                    var stillPath = episode.still_path ? 'https://image.tmdb.org/t/p/w300' + episode.still_path : '';
                    
                    var title = episode.name || 'Эпизод ' + epNum;
                    var rating = episode.vote_average ? episode.vote_average.toFixed(1) : '0.0';
                    var airDate = episode.air_date ? Lampa.Utils.parseTime(episode.air_date).full : '';
                    
                    var infoParts = [];
                    if (rating !== '0.0') infoParts.push('⭐ ' + rating);
                    if (airDate) infoParts.push(airDate);
                    var info = infoParts.join(' ● ');

                    var orig_title = object.movie.original_name || object.movie.original_title || '';
                    var hash_timeline = Lampa.Utils.hash([current_season.season_number, episode.episode_number, orig_title].join(''));
                    
                    episode.timeline = Lampa.Timeline.view(hash_timeline);
                    
                    var html = Lampa.Template.get('online_prestige_full', {
                        title: title,
                        time: '',
                        info: info,
                        quality: ''
                    });

                    html.find('.online-prestige__timeline').append(Lampa.Timeline.render(episode.timeline));

                    var img = html.find('img')[0];
                    if (stillPath) {
                        img.onload = function() {
                            html.find('.online-prestige__img').addClass('online-prestige__img--loaded');
                            html.find('.online-prestige__loader').remove();
                        };
                        img.onerror = function() {
                            img.src = './img/img_broken.svg';
                        };
                        img.src = stillPath;
                    } else {
                        img.src = './img/img_broken.svg';
                        html.find('.online-prestige__loader').remove();
                    }

                    var item = $(html);
                    item.data('episode', episode.episode_number);
                    item.data('season', current_season.season_number);
                    item.data('index', index);

                    item.on('hover:focus', function(e) {
                        last_focused = e.target;
                        scroll.update($(this), true);
                    });

                    item.on('hover:enter click', function() {
                        var epNumber = parseInt($(this).data('episode'));
                        var seasonNumber = parseInt($(this).data('season'));
                        window.embyLastSeason = { seriesId: emby_series_id, seasonNumber: seasonNumber };

                        var overlayLoader = $('<div class="emby-loader-overlay"><div class="broadcast__spin"></div></div>');
                        explorer.render().append(overlayLoader);

                        var net = new (Lampa.Request || Lampa.Reguest)();
                        var seasonQuery = '/Items?ParentId=' + emby_series_id + '&IncludeItemTypes=Season&Fields=Id,IndexNumber';
                        
                        net.silent(buildApiUrl(seasonQuery), function(seasonData) {
                            if (is_destroyed) { overlayLoader.remove(); return; }
                            
                            if (seasonData && seasonData.Items) {
                                var season = seasonData.Items.find(function(s) { return s.IndexNumber === seasonNumber; });
                                if (season) {
                                    var episodeQuery = '/Items?ParentId=' + season.Id + '&IncludeItemTypes=Episode&Fields=Id,Name,IndexNumber,PrimaryImageTag,Container&SortBy=SortName&SortOrder=Ascending';
                                    net.silent(buildApiUrl(episodeQuery), function(episodeData) {
                                        overlayLoader.remove();
                                        if (is_destroyed) return;
                                        
                                        if (episodeData && episodeData.Items) {
                                            var sortedEpisodes = episodeData.Items.sort(function(a, b) { return (a.IndexNumber || 0) - (b.IndexNumber || 0); });
                                            var cleanMovie = sanitizeMovie(object.movie); // Очищаем данные сериала

                                            var playlist = sortedEpisodes.map(function(ep, i) {
                                                var tmdbEp = current_episodes[i];
                                                var epTimeline = tmdbEp ? tmdbEp.timeline : null;
                                                var epNumForTimeline = tmdbEp ? tmdbEp.episode_number : (i + 1);
                                                
                                                if(!epTimeline) {
                                                    var key = Lampa.Utils.hash([seasonNumber, epNumForTimeline, orig_title].join(''));
                                                    epTimeline = Lampa.Timeline.view(key);
                                                }
                                                
                                                let container = ep.Container ? ep.Container.split(',')[0] : 'mp4';
                                                
                                                return {
                                                    title: ep.Name,
                                                    url: buildStreamUrl(ep.Id, container),
                                                    poster: ep.PrimaryImageTag ? buildImageUrl(ep.Id, ep.PrimaryImageTag) : '',
                                                    timeline: epTimeline,
                                                    movie: cleanMovie, // Используем чистый объект
                                                    season: seasonNumber,
                                                    episode: epNumForTimeline
                                                };
                                            });

                                            var currentEp = playlist[epNumber - 1];
                                            if (currentEp) {
                                                // Костыль исключительно для Apple TV - используем копии объектов
                                                if (isApple && playlist.length > 1) {
                                                    currentEp.playlist = playlist.map(function(p) { return { ...p }; });
                                                }

                                                markHistoryAndWatch(object.movie, seasonNumber, epNumber);

                                                Lampa.Player.play(currentEp);
                                                Lampa.Player.playlist(playlist);
                                            }
                                        }
                                    }, function() {
                                        overlayLoader.remove();
                                        notify('Ошибка загрузки серий из Emby');
                                    });
                                } else {
                                    overlayLoader.remove();
                                    notify('Сезон не найден в Emby');
                                }
                            } else {
                                overlayLoader.remove();
                                notify('Пустой ответ серверов Emby');
                            }
                        }, function() {
                            overlayLoader.remove();
                            notify('Ошибка соединения с сервером Emby');
                        });
                    });

                    scroll.append(item);
                });
            }

            setupNavigation();
            Lampa.Controller.enable('content');
        }

        function setupNavigation() {
            Lampa.Controller.add('content', {
                toggle: function() {
                    Lampa.Controller.collectionSet(scroll.render(), explorer.render());
                    Lampa.Controller.collectionFocus(last_focused || false, scroll.render());
                },
                up: function() {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function() {
                    if (Navigator.canmove('down')) Navigator.move('down');
                },
                right: function() {
                    if (Navigator.canmove('right')) Navigator.move('right');
                },
                left: function() {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                back: function() {
                    Lampa.Activity.backward();
                }
            });
            Lampa.Controller.toggle('content');
        }

        this.render = function() {
            return explorer.render(); 
        };

        this.destroy = function() {
            is_destroyed = true;
            network.clear();
            if (scroll) scroll.destroy();
            if (explorer) explorer.destroy();
        };
    }

    /* --- Остальная часть плагина --- */
    function handleEmbyClick(movie) {
        if (!isConfigured()) return notify('Настройте Emby в параметрах');

        authenticate(function(success, error) {
            if (!success) return notify('Ошибка входа в Emby: ' + error);

            findInEmby(movie, function(item) {
                if (!item) return notify('Контент не найден в библиотеке Emby.');

                if (item.Type === 'Series') {
                    var tmdbId = extractTmdbId(movie);
                    window.embySeriesData = {
                        emby_id: item.Id,
                        tmdb_id: tmdbId,
                        title: item.Name
                    };
                    var params = {
                        emby_id: item.Id,
                        tmdb_id: tmdbId,
                        movie: movie,
                        title: item.Name
                    };
                    Lampa.Activity.push({
                        url: '',
                        title: item.Name,
                        component: 'emby_series',
                        movie: movie,
                        object: params
                    });
                } else if (item.Type === 'Movie') {
                    playMovie(item, movie);
                } else {
                    notify('Неизвестный тип контента');
                }
            });
        });
    }

    function addEmbyButton(data) {
        if (!data || !data.render || !data.movie) return;
        if (data.render.find('.emby-button').length) return;

        var button = $('<div class="full-start__button selector view--emby emby-button" data-subtitle="' + PLUGIN_NAME + ' v' + PLUGIN_VERSION + '">' +
            '<svg width="40" height="40" viewBox="0 0 40 40">' +
            '<rect width="40" height="40" rx="8" fill="#00B0FF"/>' +
            '<text x="20" y="27" text-anchor="middle" fill="#fff" font-size="24" font-weight="bold">E</text>' +
            '</svg>' +
            '<span>' + PLUGIN_NAME + '</span>' +
            '</div>');

        button.on('hover:enter click', function() { handleEmbyClick(data.movie); });

        var playButton = data.render.find('.button--play, .view--torrent').first();
        if (playButton.length) playButton.after(button);
        else data.render.find('.buttons, .activity__body').append(button);
    }

    function openEmbyLibrary() {
        if (!isConfigured()) return notify('Настройте Emby в параметрах');

        authenticate(function(success, error) {
            if (!success) return notify('Ошибка входа в Emby: ' + error);
            Lampa.Activity.push({
                title: 'Медиатека Emby',
                component: 'emby_library',
                object: { stage: 'items', title: 'Медиатека Emby' }
            });
        });
    }

    function addEmbyMenuButton() {
        var menu = $('.menu .menu__list').eq(0);
        if (!menu.length || menu.find('[data-action="emby_library"]').length) return;

        var button = $('<li class="menu__item selector" data-action="emby_library">' +
            '<div class="menu__ico"><svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="3" y="5" width="26" height="22" rx="3" stroke="currentColor" stroke-width="2.5"/>' +
            '<path d="M3 12h26M10 5v7m12-7v7M8 18h5m-5 5h5m6-5h5m-5 5h5" stroke="currentColor" stroke-width="2"/>' +
            '</svg></div><div class="menu__text">Медиатека Emby</div></li>');

        button.on('hover:enter', openEmbyLibrary);
        menu.append(button);
    }

    function initSettings() {
        Lampa.SettingsApi.addComponent({
            component: 'emby',
            name: 'Emby',
            icon: '<svg width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#00B0FF"/><text x="20" y="27" text-anchor="middle" fill="#fff" font-size="24" font-weight="bold">E</text></svg>'
        });

        Lampa.SettingsApi.addParam({
            component: 'emby',
            param: {
                name: STORAGE_URL,
                type: 'input',
                values: '',
                default: ''
            },
            field: {
                name: 'Адрес сервера',
                description: 'Нажмите для ввода'
            },
            onChange: function(value) {
                Lampa.Storage.set(STORAGE_URL, (value || '').trim());
                Lampa.Storage.set(STORAGE_ACCESS_TOKEN, '');
                Lampa.Storage.set(STORAGE_USER_ID, '');
            }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'emby',
            param: {
                name: STORAGE_API_KEY,
                type: 'input',
                values: '',
                default: ''
            },
            field: {
                name: 'API Key',
                description: 'Оставьте пустым для входа по имени пользователя и паролю'
            },
            onChange: function(value) {
                Lampa.Storage.set(STORAGE_API_KEY, (value || '').trim());
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'emby',
            param: {
                name: STORAGE_USERNAME,
                type: 'input',
                values: '',
                default: ''
            },
            field: {
                name: 'Имя пользователя Emby',
                description: 'Для входа по логину и паролю'
            },
            onChange: function(value) {
                Lampa.Storage.set(STORAGE_USERNAME, (value || '').trim());
                Lampa.Storage.set(STORAGE_ACCESS_TOKEN, '');
                Lampa.Storage.set(STORAGE_USER_ID, '');
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'emby',
            param: {
                name: STORAGE_PASSWORD,
                type: 'input',
                values: '',
                default: ''
            },
            field: {
                name: 'Пароль Emby',
                description: 'Для входа по логину и паролю'
            },
            onChange: function(value) {
                Lampa.Storage.set(STORAGE_PASSWORD, value || '');
                Lampa.Storage.set(STORAGE_ACCESS_TOKEN, '');
                Lampa.Storage.set(STORAGE_USER_ID, '');
            }
        });
    }
    
    function startPlugin() {
        Lampa.Component.add('emby_series', EmbySeriesComponent);
        Lampa.Component.add('emby_library', EmbyLibraryComponent);

        initSettings();
        addEmbyMenuButton();
        Lampa.Listener.follow('menu', function(e) {
            if (e.type === 'start') addEmbyMenuButton();
        });
        
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite') {
                addEmbyButton({
                    render: e.object.activity.render(),
                    movie: e.data.movie || e.data.card
                });
            }
        });
        console.log('%c' + PLUGIN_NAME + ' v' + PLUGIN_VERSION + ' загружен', 'color: #00ff88; font-weight: bold');
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', function(e) {
        if (e.type === 'ready') startPlugin();
    });
})();

