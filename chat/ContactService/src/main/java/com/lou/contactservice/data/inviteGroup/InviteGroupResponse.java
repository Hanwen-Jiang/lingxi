package com.lou.contactservice.data.inviteGroup;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

@Data
@AllArgsConstructor
@Accessors(chain = true)
public class InviteGroupResponse {

    /** D5: id 列表元素序列化为 String,避免前端 Long 精度丢失。 */
    @JsonSerialize(contentUsing = ToStringSerializer.class)
    private List<Long> successIds;

    @JsonSerialize(contentUsing = ToStringSerializer.class)
    private List<Long> failedIds;
}
