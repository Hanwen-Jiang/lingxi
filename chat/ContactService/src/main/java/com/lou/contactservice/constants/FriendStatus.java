package com.lou.contactservice.constants;

import lombok.Getter;

/**
 * 好友状态枚举
 */
@Getter
public enum FriendStatus {
    NORMAL(1, "好友"),
    BLACKLISTED(2, "拉黑"),
    DELETED(3, "删除");

    private final int value;
    private final String description;

    FriendStatus(int value, String description) {
        this.value = value;
        this.description = description;
    }

}

