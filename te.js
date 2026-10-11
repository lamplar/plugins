(function () {
    'use strict';
    function replaceTorrentsLabel() {
        const elements = document.querySelectorAll('.view--torrent, .torrent-manager-title, span, div');
        elements.forEach(el => {
            if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
                if (el.textContent.trim() === 'Torrents') {
                    el.textContent = 'Emby';
                }
            }
        });
    }
    const observer = new MutationObserver((mutations) => {
        replaceTorrentsLabel();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    window.addEventListener('load', replaceTorrentsLabel);
})();
