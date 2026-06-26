package com.lou.contactservice.data.BlockFriend;

import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
public class BlockFriendResponse {
    private String message;
}