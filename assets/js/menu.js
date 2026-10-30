/* QR Menu Lite — public menu: sticky tabs with active category, search, product details.
   Without JavaScript the menu still works: tabs are plain anchor links. */
(function () {
    'use strict';

    var root = document.documentElement;
    var bar = document.querySelector('.catbar');
    if (!bar) { return; }

    var tabsBox = bar.querySelector('.tabs');
    var tabs = Array.prototype.slice.call(bar.querySelectorAll('.tab'));
    var sections = Array.prototype.slice.call(document.querySelectorAll('.section'));
    var activeTab = null;
    var lockUntil = 0;

    // ------------------------------------------------ Sticky bar + active tab

    function updateBarHeight() {
        root.style.setProperty('--bar-h', bar.offsetHeight + 'px');
    }

    function setActive(tab) {
        if (!tab || tab === activeTab) { return; }
        if (activeTab) {
            activeTab.classList.remove('is-active');
            activeTab.removeAttribute('aria-current');
        }
        activeTab = tab;
        tab.classList.add('is-active');
        tab.setAttribute('aria-current', 'true');
        // Keep the active tab visible inside the horizontal tab strip.
        var left = tab.offsetLeft - (tabsBox.clientWidth - tab.offsetWidth) / 2;
        tabsBox.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }

    function tabFor(section) {
        return bar.querySelector('.tab[href="#' + section.id + '"]');
    }

    function onScroll() {
        bar.classList.toggle('is-stuck', bar.getBoundingClientRect().top <= 0 && window.scrollY > 0);
        if (Date.now() < lockUntil) { return; }

        // Active = the last visible section whose top has passed below the bar.
        var line = bar.offsetHeight + 24;
        var current = null;
        sections.forEach(function (section) {
            if (!section.hidden && section.getBoundingClientRect().top <= line) {
                current = section;
            }
        });
        if (!current) {
            current = sections.filter(function (s) { return !s.hidden; })[0];
        }
        // At the very bottom the last section is active even if it is short.
        if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight - 2) {
            var visible = sections.filter(function (s) { return !s.hidden; });
            current = visible[visible.length - 1] || current;
        }
        if (current) { setActive(tabFor(current)); }
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
        if (ticking) { return; }
        ticking = true;
        window.requestAnimationFrame(function () { ticking = false; onScroll(); });
    }, { passive: true });
    window.addEventListener('resize', function () { updateBarHeight(); onScroll(); });

    tabs.forEach(function (tab) {
        tab.addEventListener('click', function (event) {
            var section = document.getElementById(tab.getAttribute('href').slice(1));
            if (!section) { return; }
            event.preventDefault();
            setActive(tab);
            lockUntil = Date.now() + 700; // don't let the scroll spy flicker during the smooth scroll
            section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            if (history.replaceState) { history.replaceState(null, '', '#' + section.id); }
        });
    });

    updateBarHeight();
    onScroll();

    // ------------------------------------------------------------ Search

    var openButton = bar.querySelector('.search-open');
    var searchBox = bar.querySelector('.search');
    var input = searchBox.querySelector('input');
    var noResults = document.querySelector('.no-results');
    var items = Array.prototype.slice.call(document.querySelectorAll('.item')).map(function (item) {
        return { el: item, text: normalize(item.querySelector('.item-name').textContent + ' ' + (item.querySelector('.item-desc') || { textContent: '' }).textContent) };
    });

    // Case- and accent-insensitive: "corba" finds "Çorba", "IZGARA" finds "ızgara".
    function normalize(text) {
        return text.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
    }

    function filter() {
        var words = normalize(input.value).split(/\s+/).filter(Boolean);
        items.forEach(function (item) {
            item.el.hidden = !words.every(function (word) { return item.text.indexOf(word) !== -1; });
        });
        var anyVisible = false;
        sections.forEach(function (section) {
            var shown = section.querySelectorAll('.item:not([hidden])').length;
            section.hidden = shown === 0;
            section.querySelector('.count').textContent = shown; // matches only, while searching
            var label = section.querySelector('.count-label');
            if (label) { label.textContent = label.getAttribute(shown === 1 ? 'data-one' : 'data-other'); }
            anyVisible = anyVisible || shown > 0;
        });
        noResults.hidden = anyVisible;
    }

    function openSearch() {
        bar.classList.add('is-searching');
        searchBox.hidden = false;
        openButton.setAttribute('aria-expanded', 'true');
        updateBarHeight();
        input.focus();
        // Bring the menu (not the header) into view while searching.
        var top = bar.getBoundingClientRect().top + window.scrollY;
        if (window.scrollY < top) { window.scrollTo({ top: top }); }
    }

    function closeSearch() {
        input.value = '';
        filter();
        bar.classList.remove('is-searching');
        searchBox.hidden = true;
        openButton.setAttribute('aria-expanded', 'false');
        updateBarHeight();
        openButton.focus();
        onScroll();
    }

    openButton.hidden = false; // search needs JavaScript, so the button starts hidden
    openButton.addEventListener('click', openSearch);
    searchBox.querySelector('.search-close').addEventListener('click', closeSearch);
    document.querySelector('.search-reset').addEventListener('click', closeSearch);
    input.addEventListener('input', filter);
    input.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { closeSearch(); }
        if (event.key === 'Enter') { input.blur(); } // hide the phone keyboard
    });

    // ---------------------------------------------------- Product details

    var sheet = document.querySelector('.sheet');
    if (!sheet || typeof sheet.showModal !== 'function') { return; }

    var sheetPhoto = sheet.querySelector('.sheet-photo');
    var sheetImg = sheetPhoto.querySelector('img');
    var sheetTitle = sheet.querySelector('.sheet-title');
    var sheetDesc = sheet.querySelector('.sheet-desc');
    var sheetFoot = sheet.querySelector('.sheet-foot');

    items.forEach(function (item) {
        item.el.addEventListener('click', function () { openSheet(item.el); });
    });

    function openSheet(item) {
        var img = item.querySelector('.item-photo img');
        sheetPhoto.hidden = !img;
        if (img) { sheetImg.src = img.getAttribute('data-full') || img.currentSrc || img.src; } // large photo
        sheetTitle.textContent = item.querySelector('.item-name').textContent;
        var desc = item.querySelector('.item-desc');
        sheetDesc.innerHTML = desc ? desc.innerHTML : '';
        // Labels on the left, price on the right (see .sheet-foot in menu.css)
        sheetFoot.innerHTML = item.querySelector('.item-foot').innerHTML + item.querySelector('.price').outerHTML;
        sheet.classList.toggle('is-sold-out', item.classList.contains('is-sold-out'));
        root.classList.add('modal-open');
        sheet.showModal();
        sheet.scrollTop = 0;
    }

    sheet.querySelector('.sheet-close').addEventListener('click', function () { sheet.close(); });
    // A click on the dimmed background closes the details.
    sheet.addEventListener('click', function (event) {
        if (event.target === sheet) { sheet.close(); }
    });
    sheet.addEventListener('close', function () {
        root.classList.remove('modal-open');
        sheetImg.removeAttribute('src');
    });
})();
