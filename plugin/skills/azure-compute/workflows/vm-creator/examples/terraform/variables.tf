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

variable "ssh_source_address_prefix" {
  description = "Source address prefix allowed for SSH inbound (CIDR, IP, or \"*\"). Default \"*\" is open to the internet — set to your public IP or a CIDR range for production."
  type        = string
  default     = "*"
}
