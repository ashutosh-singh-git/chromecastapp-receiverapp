import Global from "./globals.js";
import ApiEndPoints from "./apiEndpoints.js";
import EventScheduler from "./eventScheduler.js";

'use strict';


/**
 * Creates the namespace
 */
var sampleplayer = sampleplayer || {};

console.log("ENV : ", process.env);
/**
 *
 * @param {!Element} element the element to attach the player
 * @struct
 * @constructor
 * @export
 */
sampleplayer.CastPlayer = function(element) {

    /**
     * The debug setting to control receiver, MPL and player logging.
     * @private {boolean}
     */
    Global.setDebug(true);

    /*if (this.debug_) {
      cast.player.api.setLoggerLevel(cast.player.api.LoggerLevel.DEBUG);
      cast.receiver.logger.setLevelValue(cast.receiver.LoggerLevel.DEBUG);
    }*/

    /**
     * The DOM element the player is attached.
     * @private {!Element}
     */
    this.element_ = element;

    /**
     * The current type of the player.
     * @private {sampleplayer.Type}
     */
    this.type_;

    this.setType_(sampleplayer.Type.VIDEO, false);

    /**
     * The current state of the player.
     * @private {sampleplayer.State}
     */
    this.state_;

    /**
     * Timestamp when state transition happened last time.
     * @private {number}
     */
    this.lastStateTransitionTime_ = 0;

    this.setState_(sampleplayer.State.LAUNCHING, false);

    /**
     * The id returned by setInterval for the screen burn timer
     * @private {number|undefined}
     */
    this.burnInPreventionIntervalId_;

    /**
     * The id returned by setTimeout for the idle timer
     * @private {number|undefined}
     */
    this.idleTimerId_;

    /**
     * The id of timer to handle seeking UI.
     * @private {number|undefined}
     */
    this.seekingTimerId_;

    /**
     * The id of timer to defer setting state.
     * @private {number|undefined}
     */
    this.setStateDelayTimerId_;

    /**
     * Current application state.
     * @private {string|undefined}
     */
    this.currentApplicationState_;

    /**
     * The DOM element for the inner portion of the progress bar.
     * @private {!Element}
     */
    this.progressBarInnerElement_ = this.getElementByClass_(
        '.controls-progress-inner');

    /**
     * The DOM element for the thumb portion of the progress bar.
     * @private {!Element}
     */
    this.progressBarThumbElement_ = this.getElementByClass_(
        '.controls-progress-thumb');

    /**
     * The DOM element for the current time label.
     * @private {!Element}
     */
    this.curTimeElement_ = this.getElementByClass_('.controls-cur-time');

    /**
     * The DOM element for the total time label.
     * @private {!Element}
     */
    this.totalTimeElement_ = this.getElementByClass_('.controls-total-time');

    /**
     * Media player to play given manifest.
     * @private {cast.player.api.Player}
     */
    this.player_ = null;

    function getEventModel(playerState){
        var event={
            uid:Global.getUid(),
            did:Global.getDid(),
            appid:Global.getAppId,
            event_type:playerState,
            contentId:Global.getContentId(),
            playSessionId:Global.getPlaySessionId()
        }
        return event;
    }

    /**
     * The media element.
     * @private {HTMLMediaElement}
     */
    this.mediaElement_ =   /** @type {HTMLMediaElement} */
        (this.element_.querySelector('video'));
    this.mediaElement_.addEventListener('error', this.onError_.bind(this), false);
    this.mediaElement_.addEventListener('playing', this.onPlaying_.bind(this),
        false);
    this.mediaElement_.addEventListener('pause', this.onPause_.bind(this), false);
    this.mediaElement_.addEventListener('ended', this.onEnded_.bind(this), false);
    this.mediaElement_.addEventListener('abort', this.onAbort_.bind(this), false);
    this.mediaElement_.addEventListener('timeupdate', this.onProgress_.bind(this),
        false);
    this.mediaElement_.addEventListener('seeking', this.onSeekStart_.bind(this),
        false);
    this.mediaElement_.addEventListener('seeked', this.onSeekEnd_.bind(this),
        false);

    this.receiverManager_ = cast.framework.CastReceiverContext.getInstance();
    this.playbackConfig_ = new cast.framework.PlaybackConfig();

    this.receiverManager_.addEventListener(cast.framework.system.EventType.READY,(e)=>{
        Global.setLog("inside on ready state");
    });
    this.playerManager_ = this.receiverManager_.getPlayerManager();

    this.receiverManager_.addEventListener(cast.framework.system.EventType.SENDER_CONNECTED,(e)=>{
        var currentState= this.playerManager_.getPlayerState();
        if(currentState=== "IDLE"){
            this.onReady_();
        }
    });
    this.playerManager_.setSupportedMediaCommands(cast.framework.messages.Command.ALL_BASIC_MEDIA | cast.framework.messages.Command.QUEUE_PREV | cast.framework.messages.Command.QUEUE_NEXT);

    this.playerManager_.addEventListener(
        cast.framework.events.EventType.PLAYER_LOAD_COMPLETE, () => {
        });
    this.playerManager_.addEventListener(
        cast.framework.events.EventType.MEDIA_FINISHED, () => {
            Global.setLog("inside media finished event");
            EventScheduler.submit(getEventModel("play_stop"),true);
            clearETimer();
        });


    this.playerManager_.addEventListener(
        cast.framework.events.EventType.LOAD_START, () => {
            EventScheduler.submit(getEventModel("play_init"),true);
            Global.setLog("Event type  LOAD_START");
        });

    this.playerManager_.addEventListener(
        cast.framework.events.EventType.LOADED_DATA, () => {
            EventScheduler.submit(getEventModel("play_start"),true);
            setTimeout(sendPlayerStatusEvent, 1 * 1000);
            Global.setLog("Event type  LOADED_DATA");
        });

    this.playerManager_.addEventListener(
        cast.framework.events.EventType.ERROR , (e) => {
            this.onError_(e);
            EventScheduler.submit(getEventModel("play_error"),true);
            Global.setLog("Event type  ERROR");


        });
    var senders;
    this.receiverManager_.addCustomMessageListener(Global.customChannel, function (customEvent) {
        Global.setLog("message received from sender " + customEvent);
    });

    let eventETimer = null;

    const clearETimer = () => {
        Global.setLog("inside clearEventQTimer ");
        clearTimeout(eventETimer);
        eventETimer = null;
    };


    const sendPlayerStatusEvent = () => {
        Global.setLog("inside sendPlayerStatusEvent "+this.playerManager_.getPlayerState());
        EventScheduler.submit(getEventModel(this.playerManager_.getPlayerState()),true);
        // clearing previous timer
        clearETimer();
        eventETimer = setTimeout(sendPlayerStatusEvent, 60 * 1000);
    };
    this.playerManager_.setMessageInterceptor( cast.framework.messages.MessageType.QUEUE_UPDATE,request=>{
        Global.setLog("inside queue update Is here");
    });


    this.playerManager_.setMessageInterceptor(
        cast.framework.messages.MessageType.LOAD,
        request => {
            var selft=this;
            Global.setContentId(request.media.contentId);
            return new Promise((resolve, reject) => {
                // Fetch content repository by requested contentId HUNGAMA_MOVIE_50629739 //playSessionId
                if (request.media && request.media.customData) {
                    Global.setUid(request.media.customData['uid']);
                    Global.setToken(request.media.customData['token']);
                    Global.setSegment(request.media.customData['segment']);
                    Global.setDid(request.media.customData['did']);
                    Global.setPlaySessionId(request.media.customData['playSessionId']);
                }

                Global.setLog(" ---"+Global.getUid()+" : uid, "+Global.getToken()+" : token, "+Global.getSegment()+" : segment, "+Global.getDid()+" : did, "+"content id is : "+Global.getContentId());
                makeRequest('GET', ApiEndPoints.playbackUrl+'?contentId='+Global.getContentId()+'&appId='+Global.getAppId,true).then(function (data) {

                    if(!data) {
                        Global.setLog("inside error !data");
                        reject();
                    } else {
                        // Adjusting request to make requested content playable
                        let url=data.playback.playUrl;
                        console.log("url "+url);
                        request.media.contentUrl = url;
                        request.media.contentType = data.playbackType;
                      /*  if(data.playback.headers.Cookie){
                        Global.setCookies(data.playback.headers.Cookie);
                       }*/
                        selft.loadMetadata_(request.media);
                        resolve(request);
                    }
                }).catch((error)=>{
                    Global.setLog("inside error catch");
                    selft.sendCustomMessagew({"error": error});
                    selft.setState_(sampleplayer.State.IDLE,false)
                    reject();
                });
            });
        });




    function makeRequest (method, url,headeIncluded) {
        return new Promise(function (resolve, reject) {
            let xhr = new XMLHttpRequest();
            xhr.open(method, url);
            if(headeIncluded){
                xhr.setRequestHeader('x-atv-utkn',Global.getUtkn("GET/v2/user/playback?contentId="+Global.getContentId()+"&appId="+Global.getAppId));
                xhr.setRequestHeader('x-atv-segment',Global.getSegment());
                xhr.setRequestHeader('x-atv-did',Global.getDid());
            }

            xhr.onload = function () {
                if (this.status >= 200 && this.status < 300) {
                    resolve(JSON.parse(xhr.response));
                } else {
                    var parsedErroe=JSON.parse(xhr.response);
                    var notifyIdR=parsedErroe.notifyId || "";
                    reject(
                        {
                            httpErrorCode: this.status,
                            errorcode: parsedErroe.errorcode,
                            appErrorTitle: parsedErroe.errortitle,
                            contentId: Global.getContentId(),
                            appErrorMessage: parsedErroe.error,
                            notifyId:notifyIdR

                        }
                    );
                }
            };
            xhr.onerror = function () {
                reject({
                    httpErrorCode: this.status,
                    statusText: xhr.statusText
                });
            };
            xhr.send();
        });
    }




    this.playerData_ = {};
    this.playerDataBinder_ = new cast.framework.ui.PlayerDataBinder(this.playerData_);

    // Update ui according to player stated
    this.playerDataBinder_.addEventListener(
        cast.framework.ui.PlayerDataEventType.STATE_CHANGED,
        e => {
            switch (e.value) {
                case cast.framework.ui.State.LAUNCHING:
                    // document.getElementById("label").innerHTML = "Launching";
                    document.state="launching";
                    Global.setLog("LAUNCHING");
                case cast.framework.ui.State.IDLE:
                    Global.setLog("IDLE");
                    break;
                case cast.framework.ui.State.LOADING:
                    Global.setLog("LOADING");
                    this.setState_(sampleplayer.State.LOADING,false);
                    break;
                case cast.framework.ui.State.BUFFERING:
                    this.setState_(sampleplayer.State.BUFFERING, false);
                    break;
                case cast.framework.ui.State.PAUSED:
                    EventScheduler.submit(getEventModel("play_pause"),true);
                    Global.setLog("PAUSED");
                    break;
                case cast.framework.ui.State.PLAYING:
                    Global.setLog("PLAYING");
                   // this.setState_(sampleplayer.State.PLAYING, false);
                    break;
                default:
                {
                    Global.setLog("default");
                }
            }
        });

};


/**
 * The amount of time in a given state before the player goes idle.
 */
sampleplayer.IDLE_TIMEOUT = {
    LAUNCHING: 1000 * 60 * 5, // 5 minutes
    LOADING: 1000 * 60 * 5,  // 5 minutes
    PAUSED: 1000 * 60 * 20,  // 20 minutes
    DONE: 1000 * 60 * 5,     // 5 minutes
    IDLE: 1000 * 60 * 5      // 5 minutes
};


/**
 * Describes the type of media being played.
 *
 * @enum {string}
 */
sampleplayer.Type = {
    AUDIO: 'audio',
    VIDEO: 'video',
    UNKNOWN: 'unknown'
};

/**
 * Describes the state of the player.
 *
 * @enum {string}
 */
sampleplayer.State = {
    LAUNCHING: 'launching',
    LOADING: 'loading',
    BUFFERING: 'buffering',
    PLAYING: 'playing',
    PAUSED: 'paused',
    DONE: 'done',
    IDLE: 'idle'
};

/**
 * The amount of time (in ms) a screen should stay idle before burn in
 * prevention kicks in
 *
 * @type {number}
 */
sampleplayer.BURN_IN_TIMEOUT = 30 * 1000;

/**
 * The minimum duration (in ms) that media info is displayed.
 *
 * @const @private {number}
 */
sampleplayer.MEDIA_INFO_DURATION_ = 3 * 1000;


/**
 * Transition animation duration (in sec).
 *
 * @const @private {number}
 */
sampleplayer.TRANSITION_DURATION_ = 1.5;


/**
 * Returns the element with the given class name
 *
 * @param {string} className The class name of the element to return.
 * @return {!Element}
 * @throws {Error} If given class cannot be found.
 * @private
 */
sampleplayer.CastPlayer.prototype.getElementByClass_ = function(className) {
    var element = this.element_.querySelector(className);
    if (element) {
        return element;
    } else {
        throw Error('Cannot find element with class: ' + className);
    }
};

sampleplayer.CastPlayer.prototype.sendCustomMessagew=function(msg){
    var sender;
    this.receiverManager_.sendCustomMessage(Global.customChannel, sender,msg);
}

/**
 * Starts the player.
 *
 * @export
 */
sampleplayer.CastPlayer.prototype.start = function() {
   /* var selft=this;
    const CustomQueue = class extends cast.framework.QueueBase {

        constructor() {
            super();
            console.log("----------- inside constructor");
        }

        onCurrentItemIdChanged(itemId) {
            console.log("----------- next item updated from queue");
            selft.sendCustomMessagew({ "nextEpisode" : "Started", "msg": "next item is playing","itemId":itemId});
        }
    };*/
    this.receiverManager_.start({ playbackConfig: this.playbackConfig_}/*{queue:new CustomQueue()}*/);
};

/**
 * Resets the media element.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.resetMediaElement_ = function() {
    this.log_('resetMediaElement_');
    this.curTimeElement_.innerText = sampleplayer.formatDuration_(0);
    this.totalTimeElement_.innerText = sampleplayer.formatDuration_(0);
    this.progressBarInnerElement_.style.width = 0 + '%';
    this.progressBarThumbElement_.style.left = 0 + '%';
};


/**
 * Loads the metadata for the given media.
 *
 */
sampleplayer.CastPlayer.prototype.loadMetadata_ = function(media) {
    this.log_('loadMetadata_');
    this.resetMediaElement_();
    var metadata = media.metadata || {};
    var titleElement = this.element_.querySelector('.media-title');
    sampleplayer.setInnerText_(titleElement, metadata.title);

    var subtitleElement = this.element_.querySelector('.media-subtitle');
    sampleplayer.setInnerText_(subtitleElement, metadata.subtitle);

    var artwork = sampleplayer.getMediaImageUrl_(media);
    if (artwork) {
        var artworkElement = this.element_.querySelector('.media-artwork');
        sampleplayer.setBackgroundImage_(artworkElement, artwork);
    }
};


/**
 * Sets the amount of time before the player is considered idle.
 *
 * @param {number} t the time in milliseconds before the player goes idle
 * @private
 */
sampleplayer.CastPlayer.prototype.setIdleTimeout_ = function(t) {
    this.log_('setIdleTimeout_: ' + t);
    var self = this;
    clearTimeout(this.idleTimerId_);
    if (t) {
        this.idleTimerId_ = setTimeout(function() {
            self.receiverManager_.stop();
        }, t);
    }
};


/**
 * Sets the type of player.
 *
 * @param {sampleplayer.Type} type The type of player.
 * @param {boolean} isLiveStream whether player is showing live content
 * @private
 */
sampleplayer.CastPlayer.prototype.setType_ = function(type, isLiveStream) {
    Global.setLog('setType_: ' + type);
    this.type_ = type;
    this.element_.setAttribute('type', type);
};


/**
 * Sets the state of the player.
 *
 * @param {sampleplayer.State} state the new state of the player
 * @param {boolean=} opt_crossfade true if should cross fade between states
 * @param {number=} opt_delay the amount of time (in ms) to wait
 * @private
 */
sampleplayer.CastPlayer.prototype.setState_ = function(
    state, opt_crossfade, opt_delay) {
    this.log_('setState_: state=' + state + ', crossfade=' + opt_crossfade +
        ', delay=' + opt_delay);
    var self = this;
    self.lastStateTransitionTime_ = Date.now();
    clearTimeout(self.delay_);
    if (opt_delay) {
        var func = function() { self.setState_(state, opt_crossfade); };
        self.delay_ = setTimeout(func, opt_delay);
    } else {
        if (!opt_crossfade) {
            self.state_ = state;
            self.element_.setAttribute('state', state);
            self.setIdleTimeout_(sampleplayer.IDLE_TIMEOUT[state.toUpperCase()]);
        } else {
            var stateTransitionTime = self.lastStateTransitionTime_;
            sampleplayer.transition_(self.element_, sampleplayer.TRANSITION_DURATION_,
                function() {
                    // In the case of a crossfade transition, the transition will be completed
                    // even if setState is called during the transition.  We need to be sure
                    // that the requested state is ignored as the latest setState call should
                    // take precedence.
                    if (stateTransitionTime < self.lastStateTransitionTime_) {
                        self.log_('discarded obsolete deferred state(' + state + ').');
                        return;
                    }
                    self.setState_(state, false);
                });
        }
    }
};



/**
 * Called when the player is ready. We initialize the UI for the launching
 * and idle screens.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onReady_ = function() {
    this.log_('onReady');
    this.setState_(sampleplayer.State.IDLE, false);
};



/**
 * Called when media has an error. Transitions to IDLE state and
 * calls to the original media manager implementation.
 *
 * @see cast.receiver.MediaManager#onError
 * @param {!Object} error
 * @private
 */
sampleplayer.CastPlayer.prototype.onError_ = function(error) {
    Global.setLog('onError');
    var self = this;
    sampleplayer.transition_(self.element_, sampleplayer.TRANSITION_DURATION_,
        function() {
            self.setState_(sampleplayer.State.IDLE, true);
        });
};


/**
 * Called when media is buffering. If we were previously playing,
 * transition to the BUFFERING state.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onBuffering_ = function() {
    tGlobal.setLog('onBuffering[readyState=' + this.mediaElement_.readyState + ']');
    if (this.state_ === sampleplayer.State.PLAYING &&
        this.mediaElement_.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
        this.setState_(sampleplayer.State.BUFFERING, false);
    }
};


/**
 * Called when media has started playing. We transition to the
 * PLAYING state.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onPlaying_ = function() {
    Global.setLog('onPlaying');
    //this.cancelDeferredPlay_('media is already playing');
    var isLoading = this.state_ == sampleplayer.State.LOADING;
    this.setState_(sampleplayer.State.PLAYING, isLoading);
};


/**
 * Called when media has been paused. If this is an auto-pause as a result of
 * buffer underflow, we transition to BUFFERING state; otherwise, if the media
 * isn't done, we transition to the PAUSED state.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onPause_ = function() {
    Global.setLog('onPause');
    // this.cancelDeferredPlay_('media is paused');
    var isIdle = this.state_ === sampleplayer.State.IDLE;
    var isDone = this.mediaElement_.currentTime === this.mediaElement_.duration;
    var isUnderflow = this.player_ && this.player_.getState()['underflow'];
    if (isUnderflow) {
        Global.setLog('isUnderflow');
        this.setState_(sampleplayer.State.BUFFERING, false);
        this.mediaManager_.broadcastStatus(/* includeMedia */ false);
    } else if (!isIdle && !isDone) {
        this.setState_(sampleplayer.State.PAUSED, false);
    }
    this.updateProgress_();
};


/**
 * Called when we receive a STOP message. We stop the media and transition
 * to the IDLE state.
 *
 * @param {cast.receiver.MediaManager.Event} event The stop event.
 * @private
 */
sampleplayer.CastPlayer.prototype.onStop_ = function(event) {
    Global.setLog('onStop');
    var self = this;
    sampleplayer.transition_(self.element_, sampleplayer.TRANSITION_DURATION_,
        function() {
            self.setState_(sampleplayer.State.IDLE, false);
            self.onStopOrig_(event);
        });
};


/**
 * Called when media has ended. We transition to the IDLE state.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onEnded_ = function() {
    Global.setLog('onEnded ----- '+Global.getContentId());
    // this.onQueueItemUpdated_();
    this.sendCustomMessagew({ "finished" : Global.getContentId(), "msg": "the content is ended"});
    // this.setState_(sampleplayer.State.IDLE, true);
};

sampleplayer.CastPlayer.prototype.onQueueItemUpdated_ = function(){
    const queueManager = this.playerManager_.getQueueManager();
    Global.setLog("inside in initialize block t 4");
    const contentIds = ['HUNGAMA_MOVIE_50629739'];
    const items = [];
    for (const contId of contentIds) {
        const item = new cast.framework.messages.QueueItem();
        item.media = new cast.framework.messages.MediaInformation();
        item.media.contentId = contId;
        items.push(item);
    }
    // Insert more items after the current playing item.
    const allItems = queueManager.getItems();
    const currentItemIndex = queueManager.getCurrentItemIndex();
    const nextItemIndex = currentItemIndex + 1;
    let insertBefore = undefined;
    if (currentItemIndex >= 0 &&
        currentItemIndex < allItems.length - 1) {
        insertBefore = allItems[nextItemIndex].itemId;
    }
    queueManager.insertItems(items, insertBefore);

};


/**
 * Called when media has been aborted. We transition to the IDLE state.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onAbort_ = function() {
    Global.setLog('onAbort');
    this.setState_(sampleplayer.State.IDLE, true);
};


/**
 * Called periodically during playback, to notify changes in playback position.
 * We transition to PLAYING state, if we were in BUFFERING or LOADING state.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onProgress_ = function() {
    // if we were previously buffering, update state to playing
    if (this.state_ === sampleplayer.State.BUFFERING ||
        this.state_ === sampleplayer.State.LOADING) {
        this.setState_(sampleplayer.State.PLAYING, false);
    }
    this.updateProgress_();
};


/**
 * Updates the current time and progress bar elements.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.updateProgress_ = function() {
    // Update the time and the progress bar
    var curTime = this.mediaElement_.currentTime;
    var totalTime = this.playerManager_.getDurationSec();
    if (!isNaN(curTime) && !isNaN(totalTime)) {
        var pct = 100 * (curTime / totalTime);
        this.curTimeElement_.innerText = sampleplayer.formatDuration_(curTime,false);
        this.totalTimeElement_.innerText = sampleplayer.formatDuration_(totalTime,true);
        this.progressBarInnerElement_.style.width = pct + '%';
        this.progressBarThumbElement_.style.left = pct + '%';
    }
};


/**
 * Callback called when user starts seeking
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onSeekStart_ = function() {
    Global.setLog('onSeekStart');
    clearTimeout(this.seekingTimeoutId_);
    this.element_.classList.add('seeking');
};


/**
 * Callback called when user stops seeking.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onSeekEnd_ = function() {
    Global.setLog('onSeekEnd');
    clearTimeout(this.seekingTimeoutId_);
    if (this.state_ !== sampleplayer.State.PAUSED){
        Global.setLog('onSeekEnd if block');
        this.setState_(sampleplayer.State.BUFFERING, false);
    }

    /*this.seekingTimeoutId_ = sampleplayer.addClassWithTimeout_(this.element_,
        'seeking', 100);*/
};





/**
 * Returns the image url for the given media object.
 *
 * @param {!cast.receiver.media.MediaInformation} media The media.
 * @return {string|undefined} The image url.
 * @private
 */
sampleplayer.getMediaImageUrl_ = function(media) {
    var metadata = media.metadata || {};
    var images = metadata['images'] || [];
    return images && images[0] && images[0]['url'];
};


/**
 * Formats the given duration.
 *
 * @param {number} dur the duration (in seconds)
 * @return {string} the time (in HH:MM:SS)
 * @private
 */
sampleplayer.formatDuration_ = function(dur,isRound=false) {
    //dur = Math.floor(dur);
    function digit(n) { return ('00' + Math.round(n)).slice(-2); }
    var hr = Math.floor(dur / 3600);
    var min = Math.floor(dur / 60) % 60;
    var sec = dur % 60;
    if (!hr) {
        return digit(min) + ':' + digit(Math.floor(sec));
    } else {
        return digit(hr) + ':' + digit(min) + ':' + digit(Math.floor(sec));
    }
};


/**
 * Adds the given className to the given element for the specified amount of
 * time.
 *
 * @param {!Element} element The element to add the given class.
 * @param {string} className The class name to add to the given element.
 * @param {number} timeout The amount of time (in ms) the class should be
 *     added to the given element.
 * @return {number} A numerical id, which can be used later with
 *     window.clearTimeout().
 * @private
 */
sampleplayer.addClassWithTimeout_ = function(element, className, timeout) {
    element.classList.add(className);
    return setTimeout(function() {
        element.classList.remove(className);
    }, timeout);
};


/**
 * Causes the given element to fade out, does something, and then fades
 * it back in.
 *
 * @param {!Element} element The element to fade in/out.
 * @param {number} time The total amount of time (in seconds) to transition.
 * @param {function()} something The function that does something.
 * @private
 */
sampleplayer.transition_ = function(element, time, something) {
    if (time <= 0) {
        something();
    } else {
        sampleplayer.fadeOut_(element, time / 2.0, function() {
            something();
            sampleplayer.fadeIn_(element, time / 2.0);
        });
    }
};


/**
 * Causes the given element to fade in.
 *
 * @param {!Element} element The element to fade in.
 * @param {number} time The amount of time (in seconds) to transition.
 * @param {function()=} opt_doneFunc The function to call when complete.
 * @private
 */
sampleplayer.fadeIn_ = function(element, time, opt_doneFunc) {
    sampleplayer.fadeTo_(element, '', time, opt_doneFunc);
};


/**
 * Causes the given element to fade out.
 *
 * @param {!Element} element The element to fade out.
 * @param {number} time The amount of time (in seconds) to transition.
 * @param {function()=} opt_doneFunc The function to call when complete.
 * @private
 */
sampleplayer.fadeOut_ = function(element, time, opt_doneFunc) {
    sampleplayer.fadeTo_(element, 0, time, opt_doneFunc);
};


/**
 * Causes the given element to fade to the given opacity in the given
 * amount of time.
 *
 * @param {!Element} element The element to fade in/out.
 * @param {string|number} opacity The opacity to transition to.
 * @param {number} time The amount of time (in seconds) to transition.
 * @param {function()=} opt_doneFunc The function to call when complete.
 * @private
 */
sampleplayer.fadeTo_ = function(element, opacity, time, opt_doneFunc) {
    var self = this;
    var id = Date.now();
    var listener = function() {
        element.style.webkitTransition = '';
        element.removeEventListener('webkitTransitionEnd', listener, false);
        if (opt_doneFunc) {
            opt_doneFunc();
        }
    };
    element.addEventListener('webkitTransitionEnd', listener, false);
    element.style.webkitTransition = 'opacity ' + time + 's';
    element.style.opacity = opacity;
};


/**
 * Returns the URL path.
 *
 * @param {string} url The URL
 * @return {string} The URL path.
 * @private
 */
sampleplayer.getPath_ = function(url) {
    var href = document.createElement('a');
    href.href = url;
    return href.pathname || '';
};


/**
 * Logging utility.
 *
 * @param {string} message to log
 * @private
 */
sampleplayer.CastPlayer.prototype.log_ = function(message) {
    if (this.debug_ && message) {
        Global.setLog(message);
    }
};


/**
 * Sets the inner text for the given element.
 *
 * @param {Element} element The element.
 * @param {string=} opt_text The text.
 * @private
 */
sampleplayer.setInnerText_ = function(element, opt_text) {
    if (!element) {
        return;
    }
    element.innerText = opt_text || '';
};


/**
 * Sets the background image for the given element.
 *
 * @param {Element} element The element.
 * @param {string=} opt_url The image url.
 * @private
 */
sampleplayer.setBackgroundImage_ = function(element, opt_url) {
    if (!element) {
        return;
    }
    element.style.backgroundImage =
        (opt_url ? 'url("' + opt_url.replace(/"/g, '\\"') + '")' : 'none');
    element.style.display = (opt_url ? '' : 'none');
};


var playerDiv = document.getElementById('player');
new sampleplayer.CastPlayer(playerDiv).start();
