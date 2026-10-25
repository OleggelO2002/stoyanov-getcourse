/* =====================================================================
   ОФОРМЛЕНИЕ GETCOURSE — ИГОРЬ СТОЯНОВ
   Один скрипт на весь аккаунт. Всё, что нужно менять без программиста,
   лежит в CONFIG ниже. Модули:
   - левое меню (профиль, аккордеон подменю, крестики у панелей)
   - верхняя панель с поиском
   - главная обучения: баннер, быстрые ссылки, картинки тренингов,
     «Вы остановились на уроке», «Актуальные события», «Полезные ссылки»
   - запоминание последнего урока (на странице урока)
   ===================================================================== */
(function () {
  'use strict';

  const CONFIG = {
    // страницы, на которых показываем баннер и правую колонку
    homePaths: ['/teach/control', '/teach/control/stream'],

    // служебные страницы GetCourse (raw-html блоки с переменными)
    usrDataUrl: '/usr-data',               // {first_name};{last_name};{email} — по строке
    lastLessonUrl: '/last-lesson-out',     // «Название урока https://.../lesson/view?id=...»
    lastLessonSaveUrl: '/last-lesson',     // принимает ?lessonTitle=&lessonUrl=

    // поиск GetCourse: GET ?q=... → { results: [{ title, url, category, trainingName }] }
    searchUrl: '/pl/search/search-lesson',

    banner: {
      title: 'Игорь Стоянов',
      lines: ['Полезные материалы, уроки, документы', 'Поддержка 24/7 для бьюти индустрии'],
      image: '',        // ссылка на фон баннера; пусто — фон рисуется градиентом в CSS
      showText: true    // false — если текст уже нарисован на картинке
    },

    // muted: true — серая карточка, как «Телеграм канал» в макете
    quickLinks: [
      { title: 'Вводный модуль', text: 'Обязательный к прохождению', href: '#' },
      { title: 'Телеграм канал', text: 'Вступить', href: 'https://t.me/igor_stoyanov', muted: true },
      { title: 'Телеграм чат', text: 'Вступить', href: '#', muted: true }
    ],

    // icon: 'telegram' | 'instagram' | не указывать
    usefulLinks: [
      { icon: 'telegram', text: 'Телеграм канал', href: 'https://t.me/igor_stoyanov' },
      { icon: 'instagram', text: 'Инстаграм', href: 'https://www.instagram.com/igor_stoyanov/' },
      { text: 'Цифровой салон будущего', href: '#' },
      { text: 'НКО', href: '#' }
    ],

    scheduleTitle: 'Актуальные события',
    scheduleOpen: false   // раскрыт ли блок событий при загрузке
  };

  // для превью и точечных правок без редактирования файла: window.ST_CONFIG = {...}
  Object.assign(CONFIG, window.ST_CONFIG || {});

  const ICONS = {
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.6-4.6"/>',
    chevronRight: '<path d="m9 5 7 7-7 7"/>',
    chevronDown: '<path d="m5 9 7 7 7-7"/>',
    telegram: '<path fill="currentColor" stroke="none" d="M20.7 4.3 3.4 11c-1 .4-1 1.4 0 1.7l4.3 1.4 1.7 5.2c.2.6 1 .8 1.5.3l2.4-2.3 4.6 3.4c.6.4 1.3.1 1.5-.6l2.9-14.3c.2-.9-.7-1.6-1.6-1.3Zm-3 3.6-7.6 6.9-.3 3-1.3-4 9.2-5.9Z"/>',
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>'
  };


  /* ===================================================================
     УТИЛИТЫ
     =================================================================== */

  // Ждёт появления элемента (GetCourse дорисовывает многое после загрузки).
  // test — дополнительное условие, например «у подменю нужный класс и есть пункты».
  function waitFor(selector, { root = document, timeout = 10000, test } = {}) {
    return new Promise(resolve => {
      const find = () => {
        const el = root.querySelector(selector);
        return el && (!test || test(el)) ? el : null;
      };
      const found = find();
      if (found) return resolve(found);

      const observer = new MutationObserver(() => {
        const el = find();
        if (!el) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      });
      observer.observe(root === document ? document.documentElement : root, {
        childList: true,
        subtree: true,
        attributes: Boolean(test),
        attributeFilter: test ? ['class', 'style'] : undefined
      });
      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  // Создаёт элемент. Текст всегда через textContent — никакого HTML из данных.
  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of [].concat(children)) {
      if (child) el.append(child);
    }
    return el;
  }

  function icon(name) {
    const span = document.createElement('span');
    span.innerHTML = `<svg class="st-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
    return span.firstChild;
  }

  // Загружает служебную страницу GetCourse и возвращает текст блока с нужным классом
  async function fetchBlockText(url, selector) {
    try {
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`статус ${response.status}`);
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const block = doc.querySelector(selector);
      if (!block) throw new Error(`нет блока ${selector}`);
      return block.textContent;
    } catch (err) {
      console.warn(`[stoyanov] ${url}:`, err.message);
      return null;
    }
  }

  const normalizePath = path => path.replace(/\/+$/, '') || '/';

  // @import в CSS не срабатывает, если CSS вставлен в настройки GetCourse, — грузим шрифты отсюда
  const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Oswald:wght@500;600&display=swap';

  function loadFonts() {
    if (document.querySelector(`link[href="${FONTS_URL}"]`)) return;
    document.head.append(h('link', { rel: 'stylesheet', href: FONTS_URL }));
  }


  /* ===================================================================
     ЛЕВОЕ МЕНЮ
     =================================================================== */
  function initLeftMenu(leftbar) {
    renderProfile(leftbar);
    initSubmenuAccordion(leftbar);
    initPanelCloseButtons(leftbar);
  }

  async function renderProfile(leftbar) {
    const link = leftbar.querySelector('.menu-item-profile > a');
    if (!link || link.querySelector('.st-profile')) return;

    // стандартный аватар GetCourse заменяем иконкой из макета, своё фото оставляем
    const avatar = link.querySelector('.menu-item-icon');
    if (avatar && /default_profile/.test(avatar.getAttribute('src') || '')) {
      avatar.replaceWith(h('span', { class: 'st-avatar' }));
    }

    // делим по «;», а не по строкам: пустая фамилия не должна сдвигать почту
    const raw = await fetchBlockText(CONFIG.usrDataUrl, '.usr-data');
    const [firstName = '', lastName = '', email = ''] = (raw || '').split(';').map(part => part.trim());
    // без страницы /usr-data берём имя, которое GetCourse сам кладёт на страницу (почты там нет)
    const fallbackName = window.accountSafeUserName && window.accountSafeUserName !== 'Guest' ? window.accountSafeUserName : '';
    const name = [firstName, lastName].filter(Boolean).join(' ') || fallbackName;
    if (!name && !email) return;

    link.append(h('span', { class: 'st-profile' }, [
      name && h('span', { class: 'st-profile__name', text: name }),
      email && h('span', { class: 'st-profile__email', text: email })
    ]));
  }

  // GetCourse по клику открывает выпадающую панель .gc-account-user-submenu-bar-<раздел>.
  // Мы её прячем (CSS) и копируем пункты внутрь карточки меню — получается аккордеон.
  function initSubmenuAccordion(leftbar) {
    const SKIP = ['menu-item-profile', 'menu-item-notifications_button_small'];
    const items = [...leftbar.querySelectorAll('.gc-account-user-menu > li.menu-item')]
      .filter(item => !SKIP.some(cls => item.classList.contains(cls)));

    items.forEach(item => {
      const key = [...item.classList].find(cls => cls.startsWith('menu-item-'))?.slice('menu-item-'.length);
      if (!key) return;

      item.addEventListener('click', async event => {
        if (event.target.closest('.st-submenu')) return; // клик по пункту подменю — обычный переход

        const wasOpen = item.classList.contains('st-open');
        items.forEach(other => other.classList.remove('st-open'));
        if (wasOpen) return;

        if (!item.querySelector('.st-submenu')) {
          const bar = await waitFor(`.gc-account-user-submenu-bar-${key}`, {
            timeout: 3000,
            test: el => el.querySelector('.gc-account-user-submenu li')
          });
          if (!bar) return; // у пункта нет подменю — GetCourse просто перейдёт по ссылке
          if (item.querySelector('.st-submenu')) return; // двойной клик: подменю уже вставил первый
          const list = bar.querySelector('.gc-account-user-submenu').cloneNode(true);
          item.append(h('div', { class: 'st-submenu' }, list));
          item.getBoundingClientRect(); // чтобы раскрытие анимировалось с нуля
        }
        item.classList.add('st-open');
      });
    });
  }

  // У панелей профиля и уведомлений нет кнопки закрытия — добавляем
  function initPanelCloseButtons(leftbar) {
    const PANELS = '.gc-account-user-submenu-bar-profile, .gc-account-user-submenu-bar-notifications_button_small';
    const addButtons = () => {
      leftbar.querySelectorAll(PANELS).forEach(panel => {
        if (panel.querySelector(':scope > .st-close')) return;
        panel.prepend(h('button', {
          class: 'st-close',
          type: 'button',
          'aria-label': 'Закрыть',
          onclick: () => { panel.style.display = 'none'; }
        }));
      });
    };
    addButtons();
    new MutationObserver(addButtons).observe(leftbar, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }


  /* ===================================================================
     ВЕРХНЯЯ ПАНЕЛЬ И ПОИСК
     =================================================================== */
  function initTopbar(main) {
    if (main.querySelector('.st-topbar')) return;

    const input = h('input', {
      class: 'st-search__input',
      type: 'search',
      placeholder: 'Поиск курсов, модулей, уроков, документов...',
      'aria-label': 'Поиск',
      autocomplete: 'off'
    });
    const results = h('div', { class: 'st-search__results', hidden: true });
    const search = h('div', { class: 'st-search' }, [
      h('label', { class: 'st-search__field' }, [icon('search'), input]),
      results
    ]);
    main.prepend(h('div', { class: 'st-topbar' }, search));

    let timer;
    let requestId = 0;

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const query = input.value.trim();
      if (!query) {
        results.hidden = true;
        return;
      }
      timer = setTimeout(async () => {
        const id = ++requestId;
        const found = await searchLessons(query);
        if (id !== requestId) return; // пришёл ответ на устаревший запрос
        renderSearchResults(results, found);
      }, 400);
    });

    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') results.hidden = true;
    });
    input.addEventListener('focus', () => {
      if (input.value.trim() && results.childElementCount) results.hidden = false;
    });
    document.addEventListener('click', event => {
      if (!search.contains(event.target)) results.hidden = true;
    });
  }

  async function searchLessons(query) {
    try {
      const response = await fetch(`${CONFIG.searchUrl}?q=${encodeURIComponent(query)}`, {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`статус ${response.status}`);
      const { results } = await response.json();
      if (!Array.isArray(results)) return [];
      return results
        .filter(item => item.url)
        .map(item => ({
          title: item.title || 'Без названия',
          description: item.trainingName || item.description || '',
          url: item.url,
          isLesson: item.category === 1 // 1 — урок, остальное — тренинг
        }));
    } catch (err) {
      console.warn('[stoyanov] поиск:', err.message);
      return [];
    }
  }

  function renderSearchResults(container, found) {
    container.replaceChildren();
    const groups = [
      ['Тренинги', found.filter(item => !item.isLesson)],
      ['Уроки', found.filter(item => item.isLesson)]
    ];

    for (const [label, list] of groups) {
      if (!list.length) continue;
      container.append(h('div', { class: 'st-search__group', text: label }));
      list.forEach(item => container.append(
        h('a', { class: 'st-search__item', href: item.url }, [
          h('span', { class: 'st-search__title', text: item.title }),
          item.description && h('span', { class: 'st-search__desc', text: item.description })
        ])
      ));
    }

    if (!found.length) {
      container.append(h('div', { class: 'st-search__empty', text: 'Ничего не найдено' }));
    }
    container.hidden = false;
  }


  /* ===================================================================
     ГЛАВНАЯ ОБУЧЕНИЯ
     =================================================================== */
  async function initHome() {
    const table = await waitFor('.stream-table');
    if (!table) return;

    document.body.classList.add('st-home');
    const schedule = document.querySelector('.xdget-lessonSchedule');
    const asideCol = buildLayout(table, schedule);
    renderTop(asideCol.parentElement);
    renderTrainingImages(table);
    renderAside(asideCol, schedule);
  }

  const COL = '[class*="col-md-"], [class*="col-sm-"], [class*="col-lg-"], [class*="col-xs-"]';

  // Раскладка «тренинги + правая колонка». Ближайшая к таблице колонка Bootstrap
  // может быть вложенной (col-md-12 внутри col-md-8), поэтому идём вверх, пока не найдём
  // ряд, где рядом с колонкой тренингов стоит ещё одна. Нет такого ряда — строим свою обёртку.
  // Возвращает правую колонку; раскладкой дальше управляет CSS-grid (.st-layout)
  function buildLayout(table, schedule) {
    let outermost = table;
    for (let col = table.closest(COL); col; col = col.parentElement?.closest(COL)) {
      outermost = col;
      const siblings = [...col.parentElement.children].filter(el => el !== col && el.matches(COL));
      if (!siblings.length) continue;

      const aside = siblings.find(el => schedule && el.contains(schedule)) || siblings[siblings.length - 1];
      col.parentElement.classList.add('st-layout');
      col.classList.add('st-main-col');
      aside.classList.add('st-aside-col');
      return aside;
    }

    const main = h('div', { class: 'st-main-col' });
    const aside = h('div', { class: 'st-aside-col' });
    outermost.before(h('div', { class: 'st-layout' }, [main, aside]));
    main.append(outermost);
    if (schedule && !main.contains(schedule)) aside.append(schedule);
    return aside;
  }

  // Баннер и быстрые ссылки — над заголовком «Тренинги»
  function renderTop(layout) {
    if (document.querySelector('.st-banner')) return;

    const header = document.querySelector('.page-header');
    // заголовок должен идти над обеими колонками, а не только над тренингами
    if (header && layout.contains(header)) layout.before(header);
    const before = header || layout;

    const { banner } = CONFIG;
    const bannerEl = h('section', { class: 'st-banner' + (banner.image ? ' st-banner--image' : '') },
      banner.showText !== false && h('div', { class: 'st-banner__body' }, [
        h('h2', { class: 'st-banner__title', text: banner.title }),
        h('p', { class: 'st-banner__text' }, banner.lines.flatMap((line, i) => (i ? [h('br'), line] : [line])))
      ])
    );
    if (banner.image) bannerEl.style.setProperty('--st-banner-image', `url("${banner.image}")`);

    // если на странице есть HTML-блок с быстрыми ссылками (quick-links.html) — переносим его,
    // иначе собираем из CONFIG.quickLinks
    const quick = document.querySelector('.st-quick') || buildQuickLinks();
    before.before(bannerEl, quick);
  }

  function buildQuickLinks() {
    return h('nav', { class: 'st-quick' }, CONFIG.quickLinks.map(link =>
      h('a', {
        class: 'st-quick__item' + (link.muted ? ' st-quick__item--muted' : ''),
        href: link.href,
        target: /^https?:/.test(link.href) ? '_blank' : null,
        rel: /^https?:/.test(link.href) ? 'noopener' : null
      }, [
        h('span', { class: 'st-quick__title', text: link.title }),
        link.text && h('span', { class: 'st-quick__text', text: link.text }),
        icon('chevronRight')
      ])
    ));
  }

  // Картинка тренинга = обложка, загруженная в настройках тренинга.
  // GetCourse отдаёт в data-training-image уменьшенную копию:
  //   //fs.getcourse.ru/fileservice/file/thumbnail/h/<hash>.png/s/150x/a/<id>/sc/<n>
  // Берём оригинал (/download/ без /s/...), чтобы PNG сохранил прозрачность и резкость.
  function renderTrainingImages(table) {
    table.querySelectorAll('tr.training-row').forEach(row => {
      const td = row.querySelector('td');
      const thumb = row.dataset.trainingImage;
      if (!td || !thumb || td.querySelector('.st-card-img')) return;

      const absolute = thumb.startsWith('//') ? location.protocol + thumb : thumb;
      const original = absolute.replace('/file/thumbnail/', '/file/download/').replace(/\/s\/[^/]+/, '');
      const fallback = absolute.replace(/\/s\/[^/]+/, '/s/600x/');

      td.append(h('img', {
        class: 'st-card-img',
        src: original,
        alt: '',
        loading: 'lazy',
        onerror: event => {
          if (event.target.src !== fallback) event.target.src = fallback;
        }
      }));
    });
  }


  /* ===================================================================
     ПРАВАЯ КОЛОНКА
     =================================================================== */
  function renderAside(col, schedule) {
    if (col.querySelector('.st-links')) return;

    const lastLesson = h('div', { class: 'st-card st-last', hidden: true });
    col.prepend(lastLesson);
    fillLastLesson(lastLesson);

    if (schedule) initSchedule(schedule);

    col.append(h('div', { class: 'st-card st-links' }, [
      h('div', { class: 'st-links__title', text: 'Полезные ссылки:' }),
      h('div', { class: 'st-links__list' }, CONFIG.usefulLinks.map(link =>
        h('a', { class: 'st-links__item', href: link.href, target: '_blank', rel: 'noopener' }, [
          link.icon && h('span', { class: 'st-links__icon' }, icon(link.icon)),
          link.text
        ])
      ))
    ]));
  }

  async function fillLastLesson(card) {
    const raw = await fetchBlockText(CONFIG.lastLessonUrl, '.last-lesson-out');
    const match = raw?.trim().match(/^([\s\S]*?)\s*(https?:\/\/\S*\/lesson\/view\?id=\d+)/);
    if (!match || !match[1]) return; // ученик ещё не открывал уроки — блок не показываем

    card.append(
      h('div', { class: 'st-last__label', text: 'Вы остановились на уроке:' }),
      h('div', { class: 'st-last__title', text: match[1].trim() }),
      h('a', { class: 'st-btn', href: match[2], text: 'Продолжить учиться' })
    );
    card.hidden = false;
  }

  // Виджет расписания GetCourse → сворачиваемая карточка «Актуальные события»
  function initSchedule(widget) {
    const header = widget.querySelector('h3');
    if (!header || widget.classList.contains('st-schedule')) return;

    widget.classList.add('st-schedule');
    widget.classList.toggle('is-open', CONFIG.scheduleOpen);
    header.textContent = CONFIG.scheduleTitle;
    header.append(icon('chevronDown'));
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');

    const toggle = () => widget.classList.toggle('is-open');
    header.addEventListener('click', toggle);
    header.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });

    addCalendarButtons(widget);
  }


  /* ===================================================================
     «ДОБАВИТЬ В КАЛЕНДАРЬ» для будущих событий
     =================================================================== */
  const MONTHS = { янв: 0, фев: 1, мар: 2, апр: 3, май: 4, мая: 4, июн: 5, июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11 };

  function parseDayLabel(text) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lower = text.toLowerCase();
    if (lower.includes('сегодня')) return today;
    if (lower.includes('завтра')) return new Date(today.getTime() + 864e5);

    const match = lower.match(/(\d{1,2})\s+([а-яё]+)/);
    const month = match && MONTHS[match[2].slice(0, 3)];
    if (month === undefined || month === null) return null;
    const date = new Date(today.getFullYear(), month, Number(match[1]));
    // в декабре расписание может показывать январь следующего года
    if (date < today && today.getMonth() - month > 6) date.setFullYear(date.getFullYear() + 1);
    return date;
  }

  function addCalendarButtons(widget) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    widget.querySelectorAll('.day').forEach(day => {
      const date = parseDayLabel(day.querySelector('.day-label')?.textContent || '');
      if (!date || date < today) return;

      day.querySelectorAll('.record').forEach(record => {
        const link = record.querySelector('.event a');
        const time = record.querySelector('.time')?.textContent.trim().match(/(\d{1,2}):(\d{2})/);
        if (!link || !time || record.querySelector('.st-cal-btn')) return;

        const start = new Date(date);
        start.setHours(Number(time[1]), Number(time[2]));
        const event = {
          title: link.textContent.trim(),
          details: record.querySelector('.event').textContent.trim(),
          start,
          end: new Date(start.getTime() + 36e5)
        };
        record.append(h('button', {
          class: 'st-cal-btn',
          type: 'button',
          text: 'Добавить в календарь',
          onclick: e => showCalendarChoice(e.currentTarget, event)
        }));
      });
    });
  }

  function showCalendarChoice(button, event) {
    const stamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const google = new URL('https://calendar.google.com/calendar/render');
    google.search = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      details: event.details,
      dates: `${stamp(event.start)}/${stamp(event.end)}`
    });
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.details.replace(/\n/g, '\\n')}`,
      `DTSTART:${stamp(event.start)}`,
      `DTEND:${stamp(event.end)}`,
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');

    button.replaceWith(h('div', { class: 'st-cal-menu' }, [
      h('a', { class: 'st-cal-btn', href: google.toString(), target: '_blank', rel: 'noopener', text: 'Google' }),
      h('a', {
        class: 'st-cal-btn',
        href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })),
        download: `${event.title}.ics`,
        text: 'Apple / Outlook'
      })
    ]));
  }


  /* ===================================================================
     ПОСЛЕДНИЙ УРОК — на странице урока сообщаем GetCourse, где ученик
     =================================================================== */
  function trackLesson() {
    if (window.self !== window.top) return; // уже внутри нашего же iframe
    const title = document.querySelector('.lesson-title-value')?.textContent.trim();
    if (!title) return;

    const params = new URLSearchParams({ lessonTitle: title, lessonUrl: location.href });
    document.body.append(h('iframe', {
      src: `${CONFIG.lastLessonSaveUrl}?${params}`,
      style: 'display:none',
      'aria-hidden': 'true',
      tabindex: '-1'
    }));
  }


  /* ===================================================================
     ЗАПУСК
     =================================================================== */
  async function init() {
    if (window.__stoyanovInited) return;
    window.__stoyanovInited = true;
    if (/editMode[=/]1/.test(location.href)) return; // в редакторе страниц ничего не трогаем
    loadFonts();

    const leftbar = await waitFor('.gc-account-leftbar', { timeout: 5000 });
    if (!leftbar) return; // страницы без кабинета (лендинги, вход)
    initLeftMenu(leftbar);

    const main = document.querySelector('.gc-main-content');
    if (main) initTopbar(main);

    if (CONFIG.homePaths.map(normalizePath).includes(normalizePath(location.pathname))) initHome();
    if (location.pathname.includes('/lesson/view')) waitFor('.lesson-title-value', { timeout: 5000 }).then(trackLesson);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
