var did;
var uid;
var token;
var segment;
var contentId;
var cookies;
var playSessionId;
var debug = true;
const Global = {
    getAppId: process.env.appId,
    customChannel: process.env.CUSTOM_CHANNEL,
    getDid: () => did,
    setDid: (value) => {
        did = value;
    },
    getUid: () => uid,
    setUid: (value) => {
        uid = value;
    },
    getPlaySessionId: () => playSessionId,
    setPlaySessionId: (value) => {
        playSessionId = value;
    },
    getToken: () => token,
    setToken: (value) => {
        token = value;
    },
    getSegment: () => segment,
    setSegment: (value) => {
        segment = value;
    },
    getCookies: () => cookies,
    setCookies: (value) => {
        cookies = value;
    },
    getContentId: () => contentId,
    setContentId: (value) => {
        contentId = value;
    },
    isDebug: () => debug,
    setDebug: (isDebug) => {
        debug = isDebug;
    },
    getUtkn: (url) => {
        const encrypted = CryptoJS.HmacSHA1(url, Global.getToken());
        // var utkn=  CryptoJS.enc.Base64.stringify(encrypted);
        console.log("token " + Global.getToken());
        var finalToken = `${Global.getUid()}:${CryptoJS.enc.Base64.stringify(encrypted)}`;
        return finalToken;
    },
    getUuid: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0; // eslint-disable-line no-bitwise
            const v = c === 'x' ? r : (r & 0x3 | 0x8); // eslint-disable-line no-bitwise, no-mixed-operators
            return v.toString(16);
        });
    },
    getTimeStamp: () => new Date().getTime(),
    setLog: (msg) => {
        if (Global.isDebug() && msg) {
            console.log("-----LOG----" + msg);
        }
    },


};


Object.freeze(Global);
export default Global;
