package com.lou.common.api;

/**
 * 字段级校验错误项(03-contracts.md §3:VALIDATION_FAILED 时 data.fieldErrors)。
 */
public class FieldError {

    private String field;
    private String message;

    public FieldError() {
    }

    public FieldError(String field, String message) {
        this.field = field;
        this.message = message;
    }

    public static FieldError of(String field, String message) {
        return new FieldError(field, message);
    }

    public String getField() {
        return field;
    }

    public void setField(String field) {
        this.field = field;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
