package com.lou.contactservice.service;

import com.lou.contactservice.data.SetAdmin.SetGroupAdminRequest;
import com.lou.contactservice.data.SetAdmin.SetGroupAdminResponse;

public interface GroupAdminService {
    SetGroupAdminResponse setGroupAdmin(SetGroupAdminRequest request);
}
