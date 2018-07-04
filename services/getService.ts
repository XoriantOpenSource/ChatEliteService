import socketService from "./socketService";

/**
 * @class
 * @classdesc Creates an instances of all services
 */
export default class getService {

    public static socketIoServicesInst: socketService;
    /**
     * @function socketIoServicesInstance
     * @description Creates and returns instance of socketIoService
     * @returns Instance of socketservice
     */
    public static socketIoServicesInstance() {
        if (!getService.socketIoServicesInst) {
            getService.socketIoServicesInst = new socketService();
        }
        return getService.socketIoServicesInst;
    }
}
