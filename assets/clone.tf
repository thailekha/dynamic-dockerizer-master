variable "access_key" {}
variable "secret_key" {}
variable "region" {}
variable "keypair_name" {}
variable "key_file" {}
variable "target_id" {}
variable "target_type" {}
variable "subnet_id" {}
variable "vpc_id" {}

variable "vpc_security_group_ids" {
  type = "list"
}

provider "aws" {
  access_key = "${var.access_key}"
  secret_key = "${var.secret_key}"
  region     = "${var.region}"
}

terraform {
  backend "s3" {
    bucket  = "terraformstatedd"
    key     = "network/terraform.tfstate"
    region  = "eu-west-1"
    encrypt = true
  }
}

//to be imported
resource "aws_instance" "target" {
  ami           = "${var.target_id}"
  instance_type = "${var.target_type}"
}

resource "aws_ami_from_instance" "cloned" {
  # count = 0
  name               = "cloned-${aws_instance.target.id}"
  source_instance_id = "${aws_instance.target.id}"
}

resource "aws_security_group" "cloned" {
  name        = "dynamic_dockerizer_agent_sg"
  description = "Used for cloned instance"
  vpc_id      = "${var.vpc_id}"

  ingress {
    from_port   = 8081
    to_port     = 8081
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "cloned" {
  # count         = 0
  ami           = "${aws_ami_from_instance.cloned.id}"
  instance_type = "${var.target_type}"
  subnet_id     = "${var.subnet_id}"

  # vpc_security_group_ids = "${var.vpc_security_group_ids}"
  security_groups = ["${aws_security_group.cloned.id}"]
  key_name        = "${var.keypair_name}"

  provisioner "file" {
    source      = "installAgent.sh"
    destination = "/tmp/installAgent.sh"

    connection {
      type        = "ssh"
      user        = "ubuntu"
      private_key = "${file("${var.key_file}")}"
    }
  }

  provisioner "remote-exec" {
    inline = [
      "chmod +x /tmp/installAgent.sh",
      "/bin/bash /tmp/installAgent.sh",
    ]

    connection {
      type        = "ssh"
      user        = "ubuntu"
      private_key = "${file("${var.key_file}")}"
    }
  }
}
