package com.lou.contactservice.data.FriendList;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 好友列表单条(新客户端 API,03-contracts.md)。
 * <p>所有 id 一律 string 化(friendId)。
 */
@Data
@Accessors(chain = true)
public class FriendListItem {

    /** 对方用户 ID(string 化)。 */
    private String friendId;

    /** 对方昵称(user.user_name)。 */
    private String nickname;

    /** 对方头像。 */
    private String avatar;

    /** 对方个性签名。 */
    private String signature;

    /** 好友关系状态。1好友,2拉黑,3删除。 */
    private Integer status;
}
