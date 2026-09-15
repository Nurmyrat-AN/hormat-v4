# Current interface translation inventory

The 34 original foundation/login keys and their database values, verified on 2026-09-15. Two mock-only keys are now retired from UI usage. This is a report, not a runtime translation source. Canonical seed values remain in migrations 001 and 002. No new or replacement translation values were needed for the stale-cache fix.

| Key | tm | ru | en |
| --- | --- | --- | --- |
| `brand.market` | MARKET | MARKET | MARKET |
| `brand.name` | HORMAT | HORMAT | HORMAT |
| `cpanel.login.changeLanguage` | Dili üýtget | Изменить язык | Change language |
| `cpanel.login.email` | E-poçta salgysy | Электронная почта | Email address |
| `cpanel.login.emailInvalid` | Dogry e-poçta salgysyny giriziň. | Введите корректный адрес электронной почты. | Enter a valid email address. |
| `cpanel.login.emailRequired` | E-poçta salgyňyzy giriziň. | Введите адрес электронной почты. | Enter your email address. |
| `cpanel.login.featureChoice` | Giň saýlaw | Большой выбор | More choice |
| `cpanel.login.featureChoiceDetail` | Dürli harytlar | Разнообразие товаров | A variety of products |
| `cpanel.login.featureConvenience` | Amatly söwda | Удобные покупки | Simple shopping |
| `cpanel.login.featureConvenienceDetail` | Hemmesi bir ýerde | Всё в одном месте | Everything in one place |
| `cpanel.login.featureService` | Ünsli hyzmat | Внимательный сервис | Thoughtful service |
| `cpanel.login.featureServiceDetail` | Size gönükdirilen | С заботой о вас | Built around you |
| `cpanel.login.hidePassword` | Açar sözi gizle | Скрыть пароль | Hide password |
| `cpanel.login.javascriptRequired` | Bu formany ulanmak üçin JavaScript-i işjeňleşdiriň. | Для использования формы включите JavaScript. | Enable JavaScript to use this form. |
| `cpanel.login.language` | Interfeýsiň dili | Язык интерфейса | Interface language |
| `cpanel.login.managedNotice` | Diňe administrator tarapyndan döredilen hasaplar üçin. | Доступ только для учётных записей, созданных администратором. | Access is limited to administrator-managed accounts. |
| `cpanel.login.password` | Açar söz | Пароль | Password |
| `cpanel.login.passwordRequired` | Açar sözüňizi giriziň. | Введите пароль. | Enter your password. |
| `cpanel.login.promoDescription` | Harytlary gözläň, deňeşdiriň we özüňize laýyk saýlaw ediň. | Находите товары, сравнивайте и выбирайте то, что вам подходит. | Discover, compare and find what works for you. |
| `cpanel.login.promoHeadline` | Gündelik söwdaňyz üçin bir platforma. | Всё для ваших покупок. На одной платформе. | Everyday shopping. One convenient place. |
| `cpanel.login.rights` | Ähli hukuklar goralan. | Все права защищены. | All rights reserved. |
| `cpanel.login.showPassword` | Açar sözi görkez | Показать пароль | Show password |
| `cpanel.login.slogan` | Gündelik durmuşyňyza amatlylyk. | Больше удобства каждый день. | A little more ease, every day. |
| `cpanel.login.sloganDetail` | Saýlawdan başlaýan täze mümkinçilikler. | Новые возможности начинаются с выбора. | New possibilities begin with a choice. |
| `cpanel.login.submit` | Giriş | Войти | Sign in |
| `cpanel.login.subtitle` | Hasabyňyza girmek üçin maglumatlaryňyzy giriziň. | Введите данные вашей учётной записи. | Enter your details to access your account. |
| `cpanel.login.title` | Dolandyryş paneline giriş | Вход в панель управления | Sign in to the control panel |
| `cpanel.login.unavailable` | Giriş häzir elýeterli däl. Administratoryňyz bilen habarlaşyň. | Вход пока недоступен. Обратитесь к администратору. | Sign-in is not available yet. Please contact your administrator. |
| `cpanel.title` | Dolandyryş paneli | Панель управления | CPanel |
| `errors.internalServer` | Serweriň içerki ýalňyşlygy | Внутренняя ошибка сервера | Internal Server Error |
| `errors.invalidLanguage` | Saýlanan dil elýeterli däl | Выбранный язык недоступен | Selected language is unavailable |
| `errors.invalidRequest` | Nädogry haýyş | Некорректный запрос | Invalid request |
| `errors.notFound` | Sahypa tapylmady | Страница не найдена | Not Found |
| `frontend.title` | Baş sahypa | Главная страница | Frontend |

## Authentication stage additions

Migration 004 adds these six keys in tm/ru/en. There are now 40 seeded keys and 38 used keys.

| Key | Turkmen | Russian | English |
| --- | --- | --- | --- |
| cpanel.auth.invalidCredentials | E-poçta ýa-da parol nädogry. | Неверный email или пароль. | Invalid email or password. |
| cpanel.auth.invalidRequest | Haýyşyň möhleti gutardy ýa-da ol nädogry. Sahypany täzeläň. | Запрос недействителен или устарел. Обновите страницу. | The request is invalid or expired. Refresh the page. |
| cpanel.auth.forbidden | Giriş gadagan. | Доступ запрещён. | Access denied. |
| cpanel.auth.tooManyAttempts | Giriş synanyşyklary aşa köp. Biraz soň gaýtadan synanyşyň. | Слишком много попыток входа. Повторите позже. | Too many sign-in attempts. Try again later. |
| cpanel.auth.signedInAs | Ulgama giren ulanyjy: | Вы вошли как: | Signed in as: |
| cpanel.auth.logout | Çykmak | Выйти | Sign out |

## Application shell additions

Migration 005 adds 22 keys / 66 values. Current totals: 62 seeded keys / 186 values; 60 used keys.

| Key | Turkmen | Russian | English |
| --- | --- | --- | --- |
| cpanel.shell.mainGroup | Esasy | Основное | Main |
| cpanel.shell.overview | Syn | Обзор | Overview |
| cpanel.shell.demoGroup | Interfeýs nusgasy | Пример интерфейса | Interface preview |
| cpanel.shell.layoutPreview | Menýunyň nusgasy | Пример меню | Menu example |
| cpanel.shell.foundation | Paneliň binýady | Основа панели | Panel foundation |
| cpanel.shell.demoUnavailable | Nusga — elýeterli däl | Пример — недоступно | Example — unavailable |
| cpanel.shell.skipContent | Mazmuna geçmek | Перейти к содержимому | Skip to content |
| cpanel.shell.workspace | Iş meýdançasy | Рабочее пространство | Workspace |
| cpanel.shell.ready | Işe taýýar | Готово к работе | Ready to work |
| cpanel.shell.subtitle | Işiňiz üçin bir bitewi giňişlik. | Единое пространство для вашей работы. | One considered space for your work. |
| cpanel.shell.welcome | Hoş geldiňiz, | Добро пожаловать, | Welcome, |
| cpanel.shell.welcomeDescription | Dolandyryş paneliňiziň binýady taýýar. Geljekki iş bölümleri şu ýerde peýda bolar. | Основа вашей панели управления готова. Здесь будут появляться новые рабочие разделы. | Your control panel foundation is ready. New work areas will find their place here. |
| cpanel.shell.foundationNote | Häzirlikçe diňe interfeýsiň binýady elýeterlidir. | Пока здесь только основа интерфейса. | For now, this space contains the interface foundation. |
| cpanel.shell.closeMenu | Menýuny ýapmak | Закрыть меню | Close menu |
| cpanel.shell.navigation | Paneliň menýusy | Навигация панели | Panel navigation |
| cpanel.shell.pin | Menýuny berkitmek | Закрепить меню | Pin sidebar |
| cpanel.shell.unpin | Menýuny boşatmak | Открепить меню | Unpin sidebar |
| cpanel.shell.personalWorkspace | Şahsy iş giňişligiňiz | Ваше рабочее пространство | Your personal workspace |
| cpanel.shell.toggleMenu | Menýuny açmak ýa-da ýygnamak | Открыть или свернуть меню | Toggle sidebar |
| cpanel.shell.darkMode | Garaňky tema geçmek | Включить тёмную тему | Switch to dark mode |
| cpanel.shell.lightMode | Açyk tema geçmek | Включить светлую тему | Switch to light mode |
| cpanel.shell.userMenu | Ulanyjy menýusy | Меню пользователя | User menu |

## Navigation roadmap additions

Migration 006: 43 keys / 129 real values. Totals: 105 seeded keys, 315 values, 98 used keys.

| Key | Turkmen | Russian | English |
| --- | --- | --- | --- |
| cpanel.navigation.group.overview | Syn | Обзор | Overview |
| cpanel.navigation.dashboard | Dolandyryş syny | Дашборд | Dashboard |
| cpanel.navigation.group.catalog | Katalog | Каталог | Catalog |
| cpanel.navigation.products | Harytlar | Товары | Products |
| cpanel.navigation.categories | Kategoriýalar | Категории | Categories |
| cpanel.navigation.brands | Brendler | Бренды | Brands |
| cpanel.navigation.media | Media | Медиа | Media |
| cpanel.navigation.discounts | Arzanladyşlar | Скидки | Discounts |
| cpanel.navigation.group.vendors | Üpjin edijiler | Поставщики | Vendors |
| cpanel.navigation.vendors | Üpjin edijiler | Поставщики | Vendors |
| cpanel.navigation.sourceProducts | Çeşme harytlary | Исходные товары | Source Products |
| cpanel.navigation.group.sales | Satuwlar | Продажи | Sales |
| cpanel.navigation.orders | Sargytlar | Заказы | Orders |
| cpanel.navigation.customers | Müşderiler | Клиенты | Customers |
| cpanel.navigation.shopping | Söwda | Покупки | Shopping |
| cpanel.navigation.carts | Sebetler | Корзины | Carts |
| cpanel.navigation.favorites | Halananlar | Избранное | Favorites |
| cpanel.navigation.reviews | Synlar | Отзывы | Reviews |
| cpanel.navigation.group.communication | Aragatnaşyk | Коммуникация | Communication |
| cpanel.navigation.liveChat | Göni söhbetdeşlik | Онлайн-чат | Live Chat |
| cpanel.navigation.notifications | Duýduryşlar | Уведомления | Notifications |
| cpanel.navigation.group.content | Mazmun | Контент | Content |
| cpanel.navigation.customPages | Goşmaça sahypalar | Пользовательские страницы | Custom Pages |
| cpanel.navigation.groups | Toparlar | Группы | Groups |
| cpanel.navigation.group.marketplace | Söwda meýdançasy | Маркетплейс | Marketplace |
| cpanel.navigation.deliveryTypes | Eltip bermegiň görnüşleri | Способы доставки | Delivery Types |
| cpanel.navigation.paymentTypes | Töleg görnüşleri | Способы оплаты | Payment Types |
| cpanel.navigation.orderStatuses | Sargyt ýagdaýlary | Статусы заказов | Order Statuses |
| cpanel.navigation.restrictions | Çäklendirmeler | Ограничения | Restrictions |
| cpanel.navigation.group.searchAnalytics | Gözleg we seljerme | Поиск и аналитика | Search & Analytics |
| cpanel.navigation.search | Gözleg | Поиск | Search |
| cpanel.navigation.searchSynonyms | Gözleg sinonimleri | Поисковые синонимы | Search Synonyms |
| cpanel.navigation.analytics | Seljerme | Аналитика | Analytics |
| cpanel.navigation.group.system | Ulgam | Система | System |
| cpanel.navigation.access | Giriş ygtyýarlary | Доступ | Access |
| cpanel.navigation.users | Ulanyjylar | Пользователи | Users |
| cpanel.navigation.permissions | Ygtyýarlyklar | Разрешения | Permissions |
| cpanel.navigation.localization | Lokallaşdyrma | Локализация | Localization |
| cpanel.navigation.languages | Diller | Языки | Languages |
| cpanel.navigation.interfaceTranslations | Interfeýs terjimeleri | Переводы интерфейса | Interface Translations |
| cpanel.navigation.settings | Sazlamalar | Настройки | Settings |
| cpanel.navigation.systemEvents | Ulgam wakalary | Системные события | System Events |
| cpanel.navigation.notAvailable | Entek elýeterli däl | Пока недоступно | Not available yet |

## Profile UI additions

Migration 007 adds 15 keys / 45 real values. Existing show/hide password labels are reused.

| Key | tm | ru | en |
| --- | --- | --- | --- |
| cpanel.profile.title | Profil | Профиль | Profile |
| cpanel.profile.subtitle | Şahsy hasap maglumatlaryňyzy dolandyryň. | Управляйте личной информацией вашего аккаунта. | Manage your personal account information. |
| cpanel.userMenu.profile | Meniň profilim | Мой профиль | My Profile |
| cpanel.profile.tabs.basic | Esasy maglumatlar | Основная информация | Basic Information |
| cpanel.profile.tabs.password | Paroly üýtgetmek | Изменить пароль | Change Password |
| cpanel.profile.fields.name | Ady | Имя | Name |
| cpanel.profile.fields.phone | Telefon | Телефон | Phone |
| cpanel.profile.fields.job | Wezipesi | Должность | Job |
| cpanel.profile.fields.email | Elektron poçta | Электронная почта | Email |
| cpanel.profile.avatar.change | Suraty üýtgetmek | Изменить фото | Change Photo |
| cpanel.profile.actions.save | Üýtgeşmeleri ýatda saklamak | Сохранить изменения | Save Changes |
| cpanel.profile.password.current | Häzirki parol | Текущий пароль | Current Password |
| cpanel.profile.password.new | Täze parol | Новый пароль | New Password |
| cpanel.profile.password.confirm | Täze paroly tassyklaň | Подтвердите новый пароль | Confirm New Password |
| cpanel.profile.previewNotice | Bu diňe interfeýsiň synag görnüşidir. Üýtgeşmeler ýatda saklanmaýar. | Это предварительный просмотр интерфейса. Изменения не сохраняются. | This is an interface preview. Changes are not saved. |

## Password change additions

Migration 008: eight keys / 24 real values.

| Key | tm | ru | en |
| --- | --- | --- | --- |
| cpanel.password.required | Ähli parol meýdanlaryny dolduryň. | Заполните все поля пароля. | Complete all password fields. |
| cpanel.password.policy | Parol azyndan 12 simwoldan ybarat bolmaly we 1024 baýtdan geçmeli däl. | Пароль должен содержать не менее 12 символов и не более 1024 байт. | Password must contain at least 12 characters and at most 1024 bytes. |
| cpanel.password.mismatch | Täze parol we tassyklama gabat gelenok. | Новый пароль и подтверждение не совпадают. | New password and confirmation do not match. |
| cpanel.password.same | Täze parol häzirki paroldan tapawutly bolmaly. | Новый пароль должен отличаться от текущего. | New password must differ from the current password. |
| cpanel.password.incorrect | Häzirki parol nädogry. | Текущий пароль неверен. | Current password is incorrect. |
| cpanel.password.success | Parol üstünlikli üýtgedildi. | Пароль успешно изменён. | Password changed successfully. |
| cpanel.password.failure | Paroly üýtgedip bolmady. Gaýtadan synanyşyň. | Не удалось изменить пароль. Попробуйте ещё раз. | Unable to change password. Please try again. |
| cpanel.password.limited | Synanyşyklar aşa köp. 15 minutdan gaýtadan synanyşyň. | Слишком много попыток. Повторите через 15 минут. | Too many attempts. Try again in 15 minutes. |

## Universal uploader additions

Migration 009: 11 keys / 33 real values.

| Key | tm | ru | en |
| --- | --- | --- | --- |
| cpanel.media.fileRequired | Faýl saýlaň. | Выберите файл. | Choose a file. |
| cpanel.media.fileTooLarge | Faýlyň ölçegi rugsat berlen çäkden geçýär. | Размер файла превышает установленный лимит. | The file exceeds the configured size limit. |
| cpanel.media.typeNotAllowed | Faýlyň bu görnüşine rugsat berilmeýär. | Этот тип файла не разрешён. | This file type is not allowed. |
| cpanel.media.fileInvalid | Ýükleme soragy nädogry. Bir faýl saýlap, gaýtadan synanyşyň. | Некорректный запрос загрузки. Выберите один файл и повторите попытку. | Invalid upload request. Choose one file and try again. |
| cpanel.media.uploadFailed | Faýly ýükläp bolmady. Gaýtadan synanyşyň. | Не удалось загрузить файл. Повторите попытку. | Unable to upload the file. Please try again. |
| cpanel.media.uploading | Faýl ýüklenýär… | Файл загружается… | Uploading file… |
| cpanel.media.uploaded | Wagtlaýyn faýl ýüklendi. | Временный файл загружен. | Temporary file uploaded. |
| cpanel.media.chooseFile | Faýl saýlamak | Выбрать файл | Choose File |
| cpanel.media.removeSelection | Saýlawy aýyrmak | Убрать выбранный файл | Remove Selection |
| cpanel.media.retry | Gaýtadan synanyşmak | Повторить | Retry |
| cpanel.media.previewFile | Faýly açmak | Открыть файл | Open File |

## Profile activation (migration 010)

| Key | tm | ru | en |
| --- | --- | --- | --- |
| cpanel.profile.saved | Profil maglumatlary täzelendi. | Данные профиля сохранены. | Profile information saved. |
| cpanel.profile.invalidName | Adyňyzy giriziň (iň köp 200 nyşan). | Укажите имя длиной до 200 символов. | Enter a name of up to 200 characters. |
| cpanel.profile.invalidPhone | Telefon belgisi 50 nyşandan uzyn bolmaly däl. | Телефон должен содержать не более 50 символов. | Phone must contain no more than 50 characters. |
| cpanel.profile.avatarFailed | Suraty saklap bolmady. Faýly täzeden ýükläň. | Не удалось сохранить аватар. Загрузите файл повторно. | Unable to save the avatar. Please upload the file again. |
| cpanel.profile.failure | Profil maglumatlaryny saklap bolmady. Gaýtadan synanyşyň. | Не удалось сохранить профиль. Повторите попытку. | Unable to save the profile. Please try again. |

## Users UI (migration 011)

32 semantic cpanel.users keys with real tm/ru/en values are maintained in [the canonical SQL source](../src/database/migrations/011_cpanel_users_ui_translations.sql). Existing profile/media labels are reused.

## Users refinement translations

[Migration 012](../src/database/migrations/012_cpanel_users_refinement_translations.sql) adds `cpanel.users.allStatuses`, `cpanel.users.superuser`, `cpanel.users.protected`, each with real tm/ru/en values. It updates `cpanel.users.clear` to Reset filters in all three languages.

## Users backend translations

[Migration 014](../src/database/migrations/014_cpanel_users_backend_translations.sql) adds 11 backend keys with real tm/ru/en values for validation, duplicate email, missing user, self-deactivation denial, generic failure and five successful operations. Existing forbidden/protected/password/profile/media messages are reused.

## Permissions Management UI

Migration `015_cpanel_permissions_ui_translations.sql` adds 13 keys (39 real tm/ru/en values): `cpanel.permissions.subtitle`, `fullAccess`, `protected`, `grantedCount`, `edit`, `back`, `unsaved`, `loadFailed`, and `cpanel.permissions.users.view/create/update/status/password`. Existing navigation Users/Permissions/Search, user status/search/pagination, profile Save/preview and Cancel labels are reused. Registry entries reference translation keys only. Current canonical totals: 203 keys and 609 required-language values; current UI inventory: 191 keys.

## Permissions activation

Migration 016 adds `cpanel.permissions.access.view`, `cpanel.permissions.access.update`, `cpanel.permissions.selfEdit`, `cpanel.permissions.readOnly`, `cpanel.permissions.saving`, `cpanel.permissions.saveFailed`, `cpanel.permissions.saved`. All seven have real tm/ru/en values (21 rows). Current totals: 210 keys / 630 translations; 197 used UI keys. The obsolete profile preview notice remains in migration history, not the activated Permissions UI.

## Media File Manager UI

Migration 017 introduces 54 `cpanel.media.*` UI and permission metadata keys with 162 real tm/ru/en values. Current totals supersede migration 016: 264 canonical keys, 792 translations and 249 used UI keys. PostgreSQL remains the source; no language dictionary files exist.

Media continuation migration 018 adds seven real tm/ru/en keys (21 values): refresh, notFound, backToRoot, mime, dimensions, children and cacheWarning in cpanel.media. Current totals: 271 canonical keys / 813 values / 256 used UI keys. New manager filesystem fixture tests are isolated; live manager checks are read-only.

Media activation: migration 019 adds 13 keys / 39 values. Totals: 284 canonical keys / 852 values / 268 used UI keys, all tm/ru/en.
