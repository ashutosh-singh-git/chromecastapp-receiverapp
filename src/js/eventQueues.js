const throttle = 20;
const queue = [];
const EventQueue = {
    add: (event, callback) => {
        console.log("inside add : "+event.name);
        if (queue.length >= throttle - 1) {
            queue.push(event);
            EventQueue.flush(callback);
        }
        else {
            queue.push(event);
        }
    },
    pop: () => queue.pop(),
    flush: (callback) => {
        console.log("inside flush : "+queue.length);
        if (queue.length > 0) {
            callback(queue.splice(0, throttle));
            return true;
        }
        // console.debug('Queue is Empty');
        return false;
    },
    addAndFlush: (event, callback) => {
        console.log(event);
        console.log("inside flush : "+queue.length);
        queue.push(event);
        EventQueue.flush(callback);
    },
    purge: () => {
        queue.length = 0;
    },
};
Object.freeze(EventQueue);
export default EventQueue;
