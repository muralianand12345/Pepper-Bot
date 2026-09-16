"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchCurated = exports.findCuratedById = exports.CURATED_STATIONS = void 0;
exports.CURATED_STATIONS = [
    { id: 'somafm-groovesalad', name: 'Groove Salad', genre: 'Chillout', country: 'US', url: 'https://ice1.somafm.com/groovesalad-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/groovesalad120.png', homepage: 'https://somafm.com/groovesalad/', source: 'curated' },
    { id: 'somafm-lush', name: 'Lush', genre: 'Chillout', country: 'US', url: 'https://ice1.somafm.com/lush-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/lush120.jpg', homepage: 'https://somafm.com/lush/', source: 'curated' },
    { id: 'somafm-dronezone', name: 'Drone Zone', genre: 'Ambient', country: 'US', url: 'https://ice1.somafm.com/dronezone-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/dronezone120.jpg', homepage: 'https://somafm.com/dronezone/', source: 'curated' },
    { id: 'somafm-deepspaceone', name: 'Deep Space One', genre: 'Ambient', country: 'US', url: 'https://ice1.somafm.com/deepspaceone-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/deepspaceone120.gif', homepage: 'https://somafm.com/deepspaceone/', source: 'curated' },
    { id: 'somafm-spacestation', name: 'Space Station Soma', genre: 'Electronic', country: 'US', url: 'https://ice1.somafm.com/spacestation-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/spacestation120.jpg', homepage: 'https://somafm.com/spacestation/', source: 'curated' },
    { id: 'somafm-defcon', name: 'DEF CON Radio', genre: 'Electronic', country: 'US', url: 'https://ice1.somafm.com/defcon-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/defcon120.png', homepage: 'https://somafm.com/defcon/', source: 'curated' },
    { id: 'somafm-fluid', name: 'Fluid', genre: 'Hip-Hop', country: 'US', url: 'https://ice1.somafm.com/fluid-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/fluid120.jpg', homepage: 'https://somafm.com/fluid/', source: 'curated' },
    { id: 'somafm-indiepop', name: 'Indie Pop Rocks!', genre: 'Indie', country: 'US', url: 'https://ice1.somafm.com/indiepop-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/indiepop120.jpg', homepage: 'https://somafm.com/indiepop/', source: 'curated' },
    { id: 'somafm-poptron', name: 'PopTron', genre: 'Electronic', country: 'US', url: 'https://ice1.somafm.com/poptron-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/poptron120.png', homepage: 'https://somafm.com/poptron/', source: 'curated' },
    { id: 'somafm-metal', name: 'Metal Detector', genre: 'Metal', country: 'US', url: 'https://ice1.somafm.com/metal-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/metal120.png', homepage: 'https://somafm.com/metal/', source: 'curated' },
    { id: 'somafm-u80s', name: 'Underground 80s', genre: 'Retro', country: 'US', url: 'https://ice1.somafm.com/u80s-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/u80s120.png', homepage: 'https://somafm.com/u80s/', source: 'curated' },
    { id: 'somafm-seventies', name: 'Left Coast 70s', genre: 'Retro', country: 'US', url: 'https://ice1.somafm.com/seventies-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/seventies120.jpg', homepage: 'https://somafm.com/seventies/', source: 'curated' },
    { id: 'somafm-secretagent', name: 'Secret Agent', genre: 'Downtempo', country: 'US', url: 'https://ice1.somafm.com/secretagent-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/secretagent120.jpg', homepage: 'https://somafm.com/secretagent/', source: 'curated' },
    { id: 'somafm-bootliquor', name: 'Boot Liquor', genre: 'Country', country: 'US', url: 'https://ice1.somafm.com/bootliquor-128-mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://api.somafm.com/logos/120/bootliquor120.jpg', homepage: 'https://somafm.com/bootliquor/', source: 'curated' },
    { id: 'air-air-vividh-bharati', name: 'AIR Vividh Bharati', genre: 'Bollywood', country: 'IN', url: 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8', codec: 'AAC', bitrate: 64, artworkUrl: 'https://onlineradiohub.com/wp-content/uploads/2023/02/vividh-bharati.jpg', homepage: 'https://www.newsonair.gov.in/', source: 'curated' },
    { id: 'air-air-fm-gold', name: 'AIR FM Gold', genre: 'Bollywood', country: 'IN', url: 'https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio005/hlspbaudio005_Auto.m3u8', codec: 'AAC', bitrate: 64, artworkUrl: 'https://onlineradiohub.com/wp-content/uploads/2023/06/fm-gold-delhi.jpg', homepage: 'https://www.newsonair.gov.in/', source: 'curated' },
    { id: 'air-air-fm-rainbow', name: 'AIR FM Rainbow', genre: 'Pop', country: 'IN', url: 'https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio058/hlspbaudio05864kbps.m3u8', codec: 'AAC', bitrate: 64, artworkUrl: 'https://onlineradiohub.com/wp-content/uploads/2024/02/akashvaniFMRainbowKolkata.jpg', homepage: 'https://www.newsonair.gov.in/', source: 'curated' },
    { id: 'air-air-raagam', name: 'AIR Raagam', genre: 'Classical', country: 'IN', url: 'https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudioragam/hlspbaudioragam_Auto.m3u8', codec: 'AAC', bitrate: 64, artworkUrl: 'https://radiosindia.com/images/raagam.jpg', homepage: 'https://www.newsonair.gov.in/', source: 'curated' },
    { id: 'air-air-news', name: 'AIR News', genre: 'News', country: 'IN', url: 'https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio002/hlspbaudio002_Auto.m3u8', codec: 'AAC', bitrate: 64, artworkUrl: 'https://radiosindia.com/images/airnews.jpg', homepage: 'https://www.newsonair.gov.in/', source: 'curated' },
    { id: 'air-air-maitree', name: 'AIR Maitree', genre: 'World', country: 'IN', url: 'https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio245/hlspbaudio24564kbps.m3u8', codec: 'AAC', bitrate: 64, artworkUrl: 'https://onlineradiohub.com/wp-content/uploads/2024/02/akashvani-maitree.jpg', homepage: 'https://www.newsonair.gov.in/', source: 'curated' },
    { id: 'rb-hits-of-bollywood', name: 'Hits of Bollywood', genre: 'Bollywood', country: 'IN', url: 'http://stream.zeno.fm/8ty8szwpwfeuv', codec: 'MP3', bitrate: 128, artworkUrl: null, homepage: null, source: 'curated' },
    { id: 'rb-hits-of-lata-mangeshkar', name: 'Hits of Lata Mangeshkar', genre: 'Bollywood', country: 'IN', url: 'http://stream.zeno.fm/g95zm67prfhvv', codec: 'MP3', bitrate: 128, artworkUrl: null, homepage: null, source: 'curated' },
    { id: 'rb-hits-of-mohammed-rafi', name: 'Hits of Mohammed Rafi', genre: 'Bollywood', country: 'IN', url: 'http://stream.zeno.fm/0zkr7x8ztm0uv', codec: 'MP3', bitrate: 128, artworkUrl: null, homepage: null, source: 'curated' },
    { id: 'rb-k-s-chitra-tamil', name: 'K.S. Chitra Tamil', genre: 'Tamil', country: 'IN', url: 'https://stream-46.zeno.fm/aad4e51qz7zuv?zs=KFvl1-YuQkuqY2m7VeO4hQ', codec: 'AAC', bitrate: 128, artworkUrl: 'https://liveradios.in/wp-content/uploads/output-onlinepngtools-1-150x150.png', homepage: null, source: 'curated' },
    { id: 'rb-m-s-viswanathan-tamil', name: 'M.S. Viswanathan Tamil', genre: 'Tamil', country: 'IN', url: 'http://stream.zeno.fm/x7wc1xgllvsvv', codec: 'MP3', bitrate: 128, artworkUrl: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgwqztnsBno8KcNO7blVqWQwgYK0VMOoE2Nh5js4eh2vu2BBMkOs-D5fb5JQe_', homepage: null, source: 'curated' },
    { id: 'rb-reyfm-lofi', name: 'REYFM Lofi', genre: 'Lofi', country: 'DE', url: 'https://listen.reyfm.de/lofi_320kbps.mp3', codec: 'MP3', bitrate: 320, artworkUrl: 'http://reyfm.de/_nuxt/icons/icon_64x64.88ab9f.png', homepage: null, source: 'curated' },
    { id: 'rb-i-love-chillhop', name: 'I Love Chillhop', genre: 'Lofi', country: 'DE', url: 'https://ilm.stream12.radiohost.de/ilm_ilovechillhop_mp3-192?upd-meta&upd-scheme=https&_art=dD0xNzg5NTExNDYyJmQ9ZjZlOTk4N2M3YWEyNDhlN2YyNmM', codec: 'MP3', bitrate: 192, artworkUrl: 'https://www.ilovemusic.de/favicon.ico', homepage: null, source: 'curated' },
    { id: 'rb-nightwave-plaza', name: 'Nightwave Plaza', genre: 'Lofi', country: 'US', url: 'http://radio.plaza.one/opus', codec: 'OGG', bitrate: 64, artworkUrl: null, homepage: null, source: 'curated' },
    { id: 'rb-adroit-jazz-underground', name: 'Adroit Jazz Underground', genre: 'Jazz', country: 'US', url: 'https://icecast.walmradio.com:8443/jazz', codec: 'MP3', bitrate: 320, artworkUrl: 'https://icecast.walmradio.com:8443/jazz.jpg', homepage: null, source: 'curated' },
    { id: 'rb-classic-vinyl-hd', name: 'Classic Vinyl HD', genre: 'Jazz', country: 'US', url: 'https://icecast.walmradio.com:8443/classic', codec: 'MP3', bitrate: 320, artworkUrl: 'https://icecast.walmradio.com:8443/classic.jpg', homepage: null, source: 'curated' },
    { id: 'rb-classic-fm-uk', name: 'Classic FM UK', genre: 'Classical', country: 'GB', url: 'http://ice-the.musicradio.com/ClassicFMMP3', codec: 'MP3', bitrate: 128, artworkUrl: 'http://www.classicfm.com/assets_v4r/classic/img/favicon-196x196.png', homepage: null, source: 'curated' },
    { id: 'rb-jazz-radio-blues', name: 'Jazz Radio Blues', genre: 'Jazz', country: 'FR', url: 'http://jazzblues.ice.infomaniak.ch/jazzblues-high.mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'https://www.jazzradio.fr/apple-touch-icon-120x120.png', homepage: null, source: 'curated' },
    { id: 'rb-181-fm-the-beat', name: '181.FM The Beat', genre: 'Hip-Hop', country: 'US', url: 'http://listen.181fm.com/181-beat_128k.mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'http://www.181.fm/favicon.ico', homepage: null, source: 'curated' },
    { id: 'rb-181-fm-old-school', name: '181.FM Old School', genre: 'Hip-Hop', country: 'US', url: 'http://listen.181fm.com/181-oldschool_128k.mp3', codec: 'MP3', bitrate: 128, artworkUrl: 'http://www.181.fm/favicon.ico', homepage: null, source: 'curated' },
    { id: 'rb-technolovers-edm', name: 'Technolovers EDM', genre: 'EDM', country: 'DE', url: 'https://stream.technolovers.fm/edm?ref=radiobrowser', codec: 'MP3', bitrate: 192, artworkUrl: 'https://i.ibb.co/TmRLJsp/EDM-TL.jpg', homepage: null, source: 'curated' },
    { id: 'rb-pulseedm', name: 'PulseEDM', genre: 'EDM', country: 'US', url: 'http://pulseedm.cdnstream1.com:8124/1373_128', codec: 'MP3', bitrate: 128, artworkUrl: null, homepage: null, source: 'curated' },
    { id: 'rb-radio-caroline', name: 'Radio Caroline', genre: 'Rock', country: 'GB', url: 'http://78.129.202.200:8040/;', codec: 'MP3', bitrate: 128, artworkUrl: 'http://www.radiocaroline.co.uk/favicon.ico', homepage: null, source: 'curated' },
    { id: 'rb-big-r-80s-metal', name: 'Big R 80s Metal', genre: 'Metal', country: 'US', url: 'http://bigrradio.cdnstream1.com/5186_128', codec: 'MP3', bitrate: 128, artworkUrl: 'http://www.bigrradio.com/image/favicon/apple-touch-icon.png', homepage: null, source: 'curated' },
    { id: 'rb-listen-moe-k-pop', name: 'Listen.moe K-Pop', genre: 'K-Pop', country: 'JP', url: 'https://listen.moe/kpop/stream', codec: 'OGG', bitrate: 192, artworkUrl: 'https://listen.moe/favicon.ico', homepage: null, source: 'curated' },
    { id: 'rb-sbs-popasia', name: 'SBS PopAsia', genre: 'K-Pop', country: 'AU', url: 'https://sbs-ice.streamguys1.com/sbs-popasia-sbs-web', codec: 'AAC+', bitrate: 97, artworkUrl: 'https://www.sbs.com.au/_next/static/img/language/app-icon_128x128-18ef105.png', homepage: null, source: 'curated' },
];
const normalize = (value) => value.toLowerCase().trim();
const findCuratedById = (id) => exports.CURATED_STATIONS.find((station) => station.id === id) ?? null;
exports.findCuratedById = findCuratedById;
const searchCurated = (query, countryCode) => {
    const q = normalize(query);
    if (!q)
        return [...exports.CURATED_STATIONS];
    const cc = countryCode ? normalize(countryCode) : null;
    const scored = exports.CURATED_STATIONS.map((station) => {
        const name = normalize(station.name);
        const genre = normalize(station.genre);
        let score = 0;
        if (name === q)
            score = 100;
        else if (name.startsWith(q))
            score = 80;
        else if (name.includes(q))
            score = 60;
        else if (genre === q)
            score = 50;
        else if (genre.includes(q))
            score = 30;
        else if (station.country && normalize(station.country) === q)
            score = 20;
        if (score > 0 && cc && station.country && normalize(station.country) === cc)
            score += 5;
        return { station, score };
    });
    return scored
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.station);
};
exports.searchCurated = searchCurated;
