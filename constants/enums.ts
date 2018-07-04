/**
 * @enum Represents the status of the user
 */
export enum onlineStatus {
    /**
     * Status if a user is online
     */
    online = 1,
    /**
     *  Status if a user is away
     */
    away = 2,
    /**
     * Status if a user is away
     */
    offline = 3
}

/**
 * @class
 * @description Various types of messages considered
 */
export class chatType {
    /**
     * for a simple text message
     */
    public static text = "text";
    /**
     * for document upload
     */
    public static doc = "doc";
    /**
     * for notifying messages
     */
    public static message = "message";
}

/**
 * @enum Represents the platform(s) used
 */
export enum platform {
    /**
     * if the app is on web
     */
    web = 1
}
