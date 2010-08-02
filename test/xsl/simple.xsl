<?xml version="1.0"?>
<!DOCTYPE xsl:stylesheet [
	<!ENTITY % global SYSTEM "entities.dtd">
	<!ENTITY super_item "&item;[@class = 'test3']">
	%global;
]>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:import href="import.xsl"/>
	<xsl:output omit-xml-declaration="yes"/>
	<xsl:variable name="ext" select="document('../xml/f/external.xml')/document/label"/>
	<xsl:variable name="ext2" select="document('../xml/external.xml')/document/label"/>
	
	<xsl:template match="&root;">
		<div id="page" class="layout-right">
			<ul>
				<xsl:apply-templates select="&item;" mode="index"/>
			</ul>
		</div>	
	</xsl:template>
	
	<xsl:template match="&item;" mode="index">
		<li class="{@class}">
			<xsl:apply-templates select="." mode="import"/>
			<xsl:apply-templates select="$ext2"/>
		</li>
	</xsl:template>
	
	<xsl:template match="&super_item;" mode="index">
		<xsl:element name="{name()}">
			<xsl:copy-of select="@class"/>
			<xsl:attribute name="type">super</xsl:attribute>
			<xsl:apply-templates select="." mode="import"/>
			<xsl:apply-templates select="$ext"/>
		</xsl:element>
	</xsl:template>
	
	<xsl:template match="label">		<label>			<xsl:value-of select="."/>		</label>	</xsl:template>
</xsl:stylesheet>

