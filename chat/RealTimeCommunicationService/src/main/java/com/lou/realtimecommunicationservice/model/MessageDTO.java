package com.lou.realtimecommunicationservice.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName MessageDTO
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 12:22
 */

@Data
@Accessors(chain = true)
@JsonPropertyOrder({"type","data"})
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MessageDTO {
    private Integer type;

    private String msgUuid;

    private Object data;

}
