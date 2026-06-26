package com.lou.contactservice.service;

import com.lou.contactservice.data.GetGroupMembers.GroupMembersRequest;
import com.lou.contactservice.data.GetGroupMembers.GroupMembersResponse;

public interface GetGroupMembersService {
    GroupMembersResponse getGroupMembers(GroupMembersRequest request);
}
