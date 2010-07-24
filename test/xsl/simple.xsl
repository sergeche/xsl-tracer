<?xml version="1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output omit-xml-declaration="yes"/>
	<xsl:template match="/document">
		<div id="page" class="layout-right">
			<ul>
				<xsl:apply-templates select="item" mode="index"/>
			</ul>
		</div>	
	</xsl:template>
	
	<xsl:template match="item" mode="index">
		<li class="{@class}">
			<xsl:value-of select="."/>
		</li>
	</xsl:template>
</xsl:stylesheet>

