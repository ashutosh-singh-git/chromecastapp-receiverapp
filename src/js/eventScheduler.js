import EventQueue from "./eventQueues.js";
import Global from "./globals.js";
import ApiEndPoints from "./apiEndpoints.js";
let eventQTimer = null;
const eventQueueTimeout=10;

function genrateUtkn(uid,token){
    const encrypted = CryptoJS.HmacSHA1(uid, token);
   // var utkn=  CryptoJS.enc.Base64.stringify(encrypted);
    var finalToken=`${uid}:${CryptoJS.enc.Base64.stringify(encrypted)}`;
    return finalToken;
  }

const onQueueFull = (events) => {
    console.log("inside onQueueFull : "+events);
    const headers = {
        'Content-Type': 'application/json',
        'x-atv-did': Global.getDid(),
        'x-atv-utkn': genrateUtkn(Global.getUid(),Global.getToken()),
    };

    fetch(ApiEndPoints.analyticsUrl,{
        method:'POST',
        body:JSON.stringify({
            events,
            id: Global.getUuid(),
            ts: Global.getTimeStamp(),
        }),
        params:{
            appId:Global.getAppId
        },
        headers:removeFalsy(headers),
    }
    ).then((res)=>{
       console.log("event posted successfully");
    }).catch((e)=>{
        Global.setLog("There is error in posting event");
    });
};
const clearEventQTimer = () => {
    console.log("inside clearEventQTimer ");
    clearTimeout(eventQTimer);
    eventQTimer = null;
};
const flushQueueOnTimeout = () => {
    console.log("inside flushQueueOnTimeout ");
    const isQEmpty = EventQueue.flush(onQueueFull);
    // clearing previous timer
    clearEventQTimer();
    if (isQEmpty) {
        eventQTimer = setTimeout(flushQueueOnTimeout, eventQueueTimeout * 1000);
    }
};
setTimeout(flushQueueOnTimeout, eventQueueTimeout * 1000);


function removeFalsy(obj) {
    const newObj = {};
    Object.keys(obj).forEach((prop) => {
        if (obj[prop] !== undefined && obj[prop] !== null && obj[prop] !== '') {
            newObj[prop] = obj[prop];
        }
    });
    return newObj;
}

const EventScheduler = {
    me:(msg)=>{
        console.log("here is the message "+msg);
    },
    submit: (event, isCritical) => {
        console.log("global app id value "+Global.getAppId);
        if (isCritical) {
            EventQueue.addAndFlush(event, onQueueFull);
        }
        else {
            EventQueue.add(event, onQueueFull);
        }
    },
};
Object.freeze(EventScheduler);
export default EventScheduler;