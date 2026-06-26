package com.lou.contactservice.data.DeleteFriend;

import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
public class DeleteFriendResponse {
    private String message;
}