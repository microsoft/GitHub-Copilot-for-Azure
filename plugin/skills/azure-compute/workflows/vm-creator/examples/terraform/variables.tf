variable "subscription_id" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "location" {
  type    = string
  default = "eastus"
}

variable "vm_name" {
  type = string
}

variable "size" {
  type    = string
  default = "Standard_D2s_v5"
}

variable "admin_username" {
  type    = string
  default = "azureuser"
}

variable "admin_public_key" {
  type      = string
  sensitive = true
}

variable "zone" {
  type    = string
  default = ""
}

variable "os_disk_type" {
  type    = string
  default = "Premium_LRS"
}

variable "os_disk_size_gb" {
  type    = number
  default = 30
}

variable "tags" {
  type    = map(string)
  default = {}
}
