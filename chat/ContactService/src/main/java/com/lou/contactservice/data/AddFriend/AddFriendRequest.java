package com.lou.contactservice.data.AddFriend;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName AddFriendRequest
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/26 21:25
 */

@Data
@Accessors(chain = true)
public class AddFriendRequest {
    private String msg;
}
