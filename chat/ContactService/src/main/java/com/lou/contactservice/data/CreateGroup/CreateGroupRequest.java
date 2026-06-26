package com.lou.contactservice.data.CreateGroup;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

@Data
@Accessors(chain = true)
public class CreateGroupRequest {

    private Long creatorId;

    private List<Long> memberIds;
}
