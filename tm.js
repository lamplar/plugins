(function () {
    'use strict';

    // Функция для замены текста на странице
    function replaceTorrentsLabel() {
        // Ищем элементы, содержащие текст "Torrents" или соответствующие селекторы на главной Lampa
        // Обычно элементы меню или заголовки на главной имеют определенные классы или атрибуты
        const elements = document.querySelectorAll('.view--torrent, .torrent-manager-title, span, div');
        
        elements.forEach(el => {
            // Проверяем текстовые узлы или прямой текст элемента
            if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
                if (el.textContent.trim() === 'Torrents') {
                    el.textContent = 'Emby';
                }
            }
        });
    }

    // Запускаем проверку при изменении DOM (так как Lampa подгружает элементы динамически)
    const observer = new MutationObserver((mutations) => {
        replaceTorrentsLabel();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Также выполняем замену при старте
    window.addEventListener('load', replaceTorrentsLabel);
})();
