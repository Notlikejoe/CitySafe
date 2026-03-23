import client from "../lib/apiClient";

export const communityService = {
    /** Returns a merged, sorted feed of active reports + pending SOS requests */
    getFeed: () => client.get("/community/feed"),
    /** Records that a user is responding to an SOS or marking a hazard as helpful */
    respond: (requestId, type) => client.post("/community/respond", { requestId, type }),
};
