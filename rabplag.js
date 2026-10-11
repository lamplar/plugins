(function () {
    'use strict';

    function init() {
        if (window.Lampa) {
            var html = $('<div><div style="text-align: center; font-size: 24px; padding: 30px;">Рабочий плагин</div></div>');
            
            Lampa.Modal.open({
                title: 'Сообщение',
                html: html,
                onBack: function () {
                    Lampa.Modal.close();
                }
            });

            setTimeout(function () {
                Lampa.Modal.close();
            }, 4000);
        } else {
            setTimeout(init, 100);
        }
    }

    init();
})();
