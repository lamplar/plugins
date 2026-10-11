(function () {
    'use strict';

    function init() {
        if (window.Lampa) {
            Lampa.Noty.show('Рабочий плагин', {
                time: 5000
            });
            
            console.log('Плагин "Рабочий плагин" успешно запущен!');
        } else {
            setTimeout(init, 100);
        }
    }

    init();
})();
