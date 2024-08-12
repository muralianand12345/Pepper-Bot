const msToTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const formattedHours = String(hours).padStart(2, "0");
    const formattedMinutes = String(minutes).padStart(2, "0");
    const formattedSeconds = String(remainingSeconds).padStart(2, "0");

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

const textLengthOverCut = (txt: string, len = 20, lastTxt = '...') => {
    if (Array.from(txt).length > len) {
        txt = txt.slice(0, len) + lastTxt;
    }
    return txt;
}

const hyperlink = (text: string, url: string) => {
    return `[${text.replaceAll("[", "［").replaceAll("]", "］")}](${url})`;
}

const progressBar = (player: any) => {
    const progress = (Math.floor(player.position / 1000) / Math.floor(player.queue.current.duration / 1000)) * 100;
    let bar = "";
    for (let i = 0; i != Math.floor((progress * 1.5) / 10); i++) {
        bar += "▬";
    }
    bar += "●";
    for (let i = 15; i != Math.floor((progress * 1.5) / 10); i--) {
        bar += "▬";
    }
    return `**[ ${bar} ]**`;
}

export { msToTime, textLengthOverCut, hyperlink, progressBar };