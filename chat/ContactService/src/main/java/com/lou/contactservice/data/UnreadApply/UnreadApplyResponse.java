package com.lou.contactservice.data.UnreadApply;

import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
public class UnreadApplyResponse {
    private long count;
}